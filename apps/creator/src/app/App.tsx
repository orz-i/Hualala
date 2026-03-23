import { startTransition, useCallback, useEffect, useState } from "react";
import { useLocaleState } from "../i18n";
import { CreatorHomePage } from "../features/home/CreatorHomePage";
import {
  readRememberedProjectId,
  rememberProjectId,
} from "../features/home/projectIdMemory";
import { useCreatorHomeController } from "../features/home/useCreatorHomeController";
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
    projectId: searchParams.get("projectId"),
    importBatchId: searchParams.get("importBatchId"),
    shotId: searchParams.get("shotId"),
    orgId: overrideOrgId,
    userId: overrideUserId,
  };
}

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [requestContext, setRequestContext] = useState(() => getRequestContext());
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "unauthenticated">(
    "loading",
  );
  const [session, setSession] = useState<SessionViewModel | null>(null);
  const [sessionErrorMessage, setSessionErrorMessage] = useState("");
  const identityOverride =
    requestContext.orgId && requestContext.userId
      ? {
          orgId: requestContext.orgId,
          userId: requestContext.userId,
        }
      : undefined;
  const homeProjectId = requestContext.projectId ?? readRememberedProjectId();

  useEffect(() => {
    const handlePopState = () => {
      setRequestContext(getRequestContext());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!requestContext.projectId) {
      return;
    }
    rememberProjectId(requestContext.projectId);
  }, [requestContext.projectId]);

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
    enabled: sessionState === "ready" && !requestContext.importBatchId && Boolean(requestContext.shotId),
    shotId: requestContext.shotId ?? "",
    t,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });
  const homeController = useCreatorHomeController({
    enabled:
      sessionState === "ready" &&
      !requestContext.importBatchId &&
      !requestContext.shotId,
    projectId: homeProjectId,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });

  const navigateWithSearch = useCallback(
    (
      updates: Partial<
        Record<"projectId" | "importBatchId" | "shotId" | "orgId" | "userId", string | null>
      >,
    ) => {
      const searchParams = new URLSearchParams(window.location.search);

      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === "undefined") {
          continue;
        }

        const nextValue = value?.trim();
        if (!nextValue) {
          searchParams.delete(key);
          continue;
        }

        searchParams.set(key, nextValue);
      }

      const search = searchParams.toString();
      const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
      window.history.pushState({}, "", nextUrl);
      setRequestContext(getRequestContext());
    },
    [],
  );

  const handleSelectProjectId = useCallback(() => {
    const nextProjectId = homeController.projectIdInput.trim();
    if (!nextProjectId) {
      return;
    }

    rememberProjectId(nextProjectId);
    navigateWithSearch({
      projectId: nextProjectId,
      importBatchId: null,
      shotId: null,
    });
  }, [homeController.projectIdInput, navigateWithSearch]);

  const handleOpenShotWorkbench = useCallback(() => {
    const nextShotId = homeController.shotIdInput.trim();
    if (!nextShotId) {
      return;
    }

    navigateWithSearch({
      importBatchId: null,
      shotId: nextShotId,
    });
  }, [homeController.shotIdInput, navigateWithSearch]);

  const handleOpenImportWorkbench = useCallback(
    (importBatchId: string) => {
      const nextImportBatchId = importBatchId.trim();
      if (!nextImportBatchId) {
        return;
      }

      navigateWithSearch({
        importBatchId: nextImportBatchId,
        shotId: null,
      });
    },
    [navigateWithSearch],
  );

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
    : requestContext.shotId
      ? shotWorkbenchController.errorMessage
      : "";
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

  if (!requestContext.importBatchId && !requestContext.shotId) {
    return (
      <>
        {renderSessionToolbar()}
        <CreatorHomePage
          locale={locale}
          t={t}
          onLocaleChange={setLocale}
          projectIdInput={homeController.projectIdInput}
          activeProjectId={homeProjectId}
          shotIdInput={homeController.shotIdInput}
          importBatches={homeController.importBatches}
          importBatchesPending={homeController.importBatchesPending}
          errorMessage={homeController.errorMessage || undefined}
          onProjectIdInputChange={homeController.setProjectIdInput}
          onSubmitProjectId={handleSelectProjectId}
          onShotIdInputChange={homeController.setShotIdInput}
          onSubmitShotId={handleOpenShotWorkbench}
          onOpenImportBatch={handleOpenImportWorkbench}
        />
      </>
    );
  }

  if (requestContext.importBatchId) {
    return <main style={{ padding: "32px" }}>{t("app.loading.import")}</main>;
  }

  return <main style={{ padding: "32px" }}>{t("app.loading.shot")}</main>;
}
