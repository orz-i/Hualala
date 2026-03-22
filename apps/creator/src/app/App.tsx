import { startTransition, useCallback, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
import {
  ImportBatchWorkbenchPage,
} from "../features/import-batches/ImportBatchWorkbenchPage";
import { useImportWorkbenchController } from "../features/import-batches/useImportWorkbenchController";
import { ShotWorkbenchPage } from "../features/shot-workbench/ShotWorkbenchPage";
import { useShotWorkbenchController } from "../features/shot-workbench/useShotWorkbenchController";
import {
  clearCurrentSession,
  ensureDevSession,
  isUnauthenticatedSessionError,
  loadCurrentSession,
  type SessionViewModel,
} from "../features/session/sessionBootstrap";

function getRequestContext() {
  const searchParams = new URLSearchParams(window.location.search);
  const overrideOrgId = searchParams.get("orgId") ?? undefined;
  const overrideUserId = searchParams.get("userId") ?? undefined;

  return {
    importBatchId: searchParams.get("importBatchId"),
    shotId: searchParams.get("shotId") ?? "shot-demo-001",
    orgId: overrideOrgId,
    userId: overrideUserId,
  };
}

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "unauthenticated">(
    "loading",
  );
  const [session, setSession] = useState<SessionViewModel | null>(null);
  const [sessionErrorMessage, setSessionErrorMessage] = useState("");

  const requestContext = getRequestContext();
  const identityOverride =
    requestContext.orgId && requestContext.userId
      ? {
          orgId: requestContext.orgId,
          userId: requestContext.userId,
        }
      : undefined;

  useEffect(() => {
    let cancelled = false;

    startTransition(() => {
      setSessionState("loading");
      setSession(null);
      setSessionErrorMessage("");
    });

    loadCurrentSession({
      orgId: identityOverride?.orgId,
      userId: identityOverride?.userId,
    })
      .then((nextSession) => {
        if (cancelled) {
          return;
        }
        startTransition(() => {
          setSession(nextSession);
          setSessionState("ready");
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isUnauthenticatedSessionError(error)) {
          startTransition(() => {
            setSession(null);
            setSessionState("unauthenticated");
          });
          return;
        }
        const message =
          error instanceof Error ? error.message : "creator: unknown session bootstrap error";
        startTransition(() => {
          setSessionErrorMessage(message);
          setSession(null);
          setSessionState("unauthenticated");
        });
      });

    return () => {
      cancelled = true;
    };
  }, [identityOverride?.orgId, identityOverride?.userId]);

  const importWorkbenchController = useImportWorkbenchController({
    enabled: sessionState === "ready" && Boolean(requestContext.importBatchId),
    importBatchId: requestContext.importBatchId,
    locale,
    t,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });

  const shotWorkbenchController = useShotWorkbenchController({
    enabled: sessionState === "ready" && !requestContext.importBatchId,
    shotId: requestContext.shotId,
    t,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });

  const handleStartDevSession = useCallback(async () => {
    startTransition(() => {
      setSessionState("loading");
      setSessionErrorMessage("");
    });
    try {
      const nextSession = await ensureDevSession();
      startTransition(() => {
        setSession(nextSession);
        setSessionState("ready");
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "creator: unknown start session error";
      startTransition(() => {
        setSessionErrorMessage(message);
        setSessionState("unauthenticated");
      });
    }
  }, []);

  const handleClearCurrentSession = useCallback(async () => {
    try {
      await clearCurrentSession();
      startTransition(() => {
        setSession(null);
        setSessionState("unauthenticated");
        setSessionErrorMessage("");
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "creator: unknown clear session error";
      startTransition(() => {
        setSessionErrorMessage(message);
      });
    }
  }, []);

  const renderSessionToolbar = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "16px 24px 0",
      }}
    >
      <p style={{ margin: 0, color: "#334155" }}>
        {identityOverride
          ? t("session.override.active", {
              orgId: identityOverride.orgId,
              userId: identityOverride.userId,
            })
          : t("session.active", { userId: session?.userId ?? "" })}
      </p>
      {!identityOverride ? (
        <button
          type="button"
          onClick={() => {
            void handleClearCurrentSession();
          }}
          style={{
            border: 0,
            borderRadius: "999px",
            padding: "8px 14px",
            background: "#cbd5e1",
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          {t("session.clear")}
        </button>
      ) : null}
    </div>
  );

  const workbenchErrorMessage = requestContext.importBatchId
    ? importWorkbenchController.errorMessage
    : shotWorkbenchController.errorMessage;
  const errorMessage = sessionErrorMessage || workbenchErrorMessage;

  if (errorMessage) {
    return (
      <main style={{ padding: "32px" }}>
        {t("app.error.load", { message: errorMessage })}
      </main>
    );
  }

  if (sessionState === "loading") {
    return <main style={{ padding: "32px" }}>{t("session.loading")}</main>;
  }

  if (sessionState === "unauthenticated") {
    return (
      <main style={{ padding: "32px", display: "grid", gap: "16px", maxWidth: "480px" }}>
        <h1 style={{ margin: 0 }}>{t("session.gate.title")}</h1>
        <p style={{ margin: 0 }}>{t("session.gate.description")}</p>
        <button
          type="button"
          onClick={() => {
            void handleStartDevSession();
          }}
          style={{
            width: "fit-content",
            border: 0,
            borderRadius: "999px",
            padding: "10px 18px",
            background: "#0f766e",
            color: "#f0fdfa",
            cursor: "pointer",
          }}
        >
          {t("session.gate.enter")}
        </button>
      </main>
    );
  }

  if (importWorkbenchController.importWorkbench) {
    return (
      <>
        {renderSessionToolbar()}
        <ImportBatchWorkbenchPage
          workbench={importWorkbenchController.importWorkbench}
          locale={locale}
          t={t}
          onLocaleChange={setLocale}
          selectedUploadFile={importWorkbenchController.selectedUploadFile}
          feedback={importWorkbenchController.feedback ?? undefined}
          assetProvenanceDetail={importWorkbenchController.assetProvenanceDetail}
          assetProvenancePending={importWorkbenchController.assetProvenancePending}
          assetProvenanceErrorMessage={
            importWorkbenchController.assetProvenanceErrorMessage || undefined
          }
          onChooseUploadFile={importWorkbenchController.handleChooseUploadFile}
          onRegisterSelectedUpload={importWorkbenchController.handleRegisterSelectedUpload}
          onRetryUploadSession={importWorkbenchController.handleRetryUploadSession}
          onConfirmMatches={importWorkbenchController.handleConfirmMatches}
          onSelectPrimaryAsset={importWorkbenchController.handleSelectPrimaryAsset}
          onOpenAssetProvenance={importWorkbenchController.handleOpenAssetProvenance}
          onCloseAssetProvenance={importWorkbenchController.handleCloseAssetProvenance}
        />
      </>
    );
  }

  if (shotWorkbenchController.shotWorkbench) {
    return (
      <>
        {renderSessionToolbar()}
        <ShotWorkbenchPage
          workbench={shotWorkbenchController.shotWorkbench}
          workflowPanel={shotWorkbenchController.shotWorkflowPanel ?? undefined}
          locale={locale}
          t={t}
          onLocaleChange={setLocale}
          feedback={shotWorkbenchController.feedback ?? undefined}
          assetProvenanceDetail={shotWorkbenchController.assetProvenanceDetail}
          assetProvenancePending={shotWorkbenchController.assetProvenancePending}
          assetProvenanceErrorMessage={
            shotWorkbenchController.assetProvenanceErrorMessage || undefined
          }
          onRunSubmissionGateChecks={shotWorkbenchController.handleRunSubmissionGateChecks}
          onSubmitShotForReview={shotWorkbenchController.handleSubmitShotForReview}
          onSelectPrimaryAsset={shotWorkbenchController.handleSelectPrimaryAsset}
          onOpenAssetProvenance={shotWorkbenchController.handleOpenAssetProvenance}
          onCloseAssetProvenance={shotWorkbenchController.handleCloseAssetProvenance}
          onStartWorkflow={shotWorkbenchController.handleStartWorkflow}
          onRetryWorkflowRun={shotWorkbenchController.handleRetryWorkflowRun}
        />
      </>
    );
  }

  if (requestContext.importBatchId) {
    return <main style={{ padding: "32px" }}>{t("app.loading.import")}</main>;
  }

  return <main style={{ padding: "32px" }}>{t("app.loading.shot")}</main>;
}
