import { startTransition, useCallback, useEffect, useState } from "react";
import { CollabWorkbenchPage } from "../features/collaboration/CollabWorkbenchPage";
import { useCollabController } from "../features/collaboration/useCollabController";
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
import { ActionFeedback } from "../features/shared/ActionFeedback";
import { ShotWorkbenchPage } from "../features/shot-workbench/ShotWorkbenchPage";
import { useShotWorkbenchController } from "../features/shot-workbench/useShotWorkbenchController";
import {
  clearCurrentSession,
  ensureDevSession,
  isUnauthenticatedSessionError,
  loadCurrentSession,
  type SessionViewModel,
} from "../features/session/sessionBootstrap";
import { useLocaleState } from "../i18n";
import { CreatorWorkspaceShell } from "./CreatorWorkspaceShell";
import {
  buildCreatorRouteUrl,
  normalizeLegacyCreatorUrl,
  parseCreatorRouteState,
  selectCreatorRoute,
  type CreatorRouteState,
} from "./creatorRoutes";

function getCurrentCreatorUrl() {
  return `${window.location.pathname}${window.location.search}`;
}

export function App() {
  const { locale, setLocale, t } = useLocaleState();
  const [routeState, setRouteState] = useState<CreatorRouteState>(() =>
    parseCreatorRouteState(window.location),
  );
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "unauthenticated">(
    "loading",
  );
  const [session, setSession] = useState<SessionViewModel | null>(null);
  const [sessionErrorMessage, setSessionErrorMessage] = useState("");

  const identityOverride =
    routeState.orgId && routeState.userId
      ? {
          orgId: routeState.orgId,
          userId: routeState.userId,
        }
      : undefined;
  const effectiveOrgId = identityOverride?.orgId ?? session?.orgId;
  const effectiveUserId = identityOverride?.userId ?? session?.userId;
  const homeProjectId = routeState.projectId ?? readRememberedProjectId();
  const homeRouteProjectId = homeProjectId ?? undefined;

  const commitRouteState = useCallback(
    (nextState: CreatorRouteState, mode: "push" | "replace" = "push") => {
      const nextUrl = buildCreatorRouteUrl(nextState);
      if (nextUrl !== getCurrentCreatorUrl()) {
        const historyMethod =
          mode === "replace" ? window.history.replaceState : window.history.pushState;
        historyMethod.call(window.history, {}, "", `${nextUrl}${window.location.hash}`);
      }
      setRouteState(nextState);
    },
    [],
  );

  useEffect(() => {
    const normalizedUrl = normalizeLegacyCreatorUrl(window.location);
    if (normalizedUrl !== getCurrentCreatorUrl()) {
      window.history.replaceState({}, "", `${normalizedUrl}${window.location.hash}`);
    }

    const handlePopState = () => {
      const nextState = parseCreatorRouteState(window.location);
      const nextUrl = normalizeLegacyCreatorUrl(window.location);
      if (nextUrl !== getCurrentCreatorUrl()) {
        window.history.replaceState({}, "", `${nextUrl}${window.location.hash}`);
      }
      setRouteState(nextState);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!routeState.projectId) {
      return;
    }
    rememberProjectId(routeState.projectId);
  }, [routeState.projectId]);

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
    enabled: sessionState === "ready" && routeState.route === "imports" && Boolean(routeState.importBatchId),
    importBatchId: routeState.importBatchId ?? null,
    locale,
    t,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });

  const shotWorkbenchController = useShotWorkbenchController({
    enabled: sessionState === "ready" && routeState.route === "shots" && Boolean(routeState.shotId),
    shotId: routeState.shotId ?? "",
    t,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });

  const collabOwnerType = routeState.shotId ? "shot" : "project";
  const collabOwnerId = routeState.shotId ?? routeState.projectId ?? "";

  const collabController = useCollabController({
    enabled:
      sessionState === "ready" && routeState.route === "collab" && Boolean(collabOwnerId),
    ownerType: collabOwnerType,
    ownerId: collabOwnerId,
    projectId: routeState.projectId,
    t,
    orgId: effectiveOrgId,
    userId: effectiveUserId,
  });

  const homeController = useCreatorHomeController({
    enabled: sessionState === "ready" && routeState.route === "home",
    projectId: homeProjectId,
    orgId: identityOverride?.orgId,
    userId: identityOverride?.userId,
  });

  const handleSelectProjectId = useCallback(() => {
    const nextProjectId = homeController.projectIdInput.trim();
    if (!nextProjectId) {
      return;
    }

    rememberProjectId(nextProjectId);
    commitRouteState(
      {
        ...selectCreatorRoute(routeState, "home"),
        projectId: nextProjectId,
      },
      "push",
    );
  }, [commitRouteState, homeController.projectIdInput, routeState]);

  const handleOpenShotWorkbench = useCallback(() => {
    const nextShotId = homeController.shotIdInput.trim();
    if (!nextShotId) {
      return;
    }

    commitRouteState(
      {
        ...selectCreatorRoute(
          {
            ...routeState,
            projectId: homeRouteProjectId,
          },
          "shots",
        ),
        shotId: nextShotId,
      },
      "push",
    );
  }, [commitRouteState, homeController.shotIdInput, homeRouteProjectId, routeState]);

  const handleOpenImportWorkbench = useCallback(
    (importBatchId: string) => {
      const nextImportBatchId = importBatchId.trim();
      if (!nextImportBatchId) {
        return;
      }

      commitRouteState(
        {
          ...selectCreatorRoute(
            {
              ...routeState,
              projectId: homeRouteProjectId,
            },
            "imports",
          ),
          importBatchId: nextImportBatchId,
        },
        "push",
      );
    },
    [commitRouteState, homeRouteProjectId, routeState],
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

  const handleReturnHome = useCallback(() => {
    const nextProjectId =
      routeState.projectId ??
      readRememberedProjectId() ??
      importWorkbenchController.importWorkbench?.importBatch.projectId ??
      collabController.collaborationSession?.scope?.projectId ??
      shotWorkbenchController.shotWorkbench?.shotExecution.projectId ??
      undefined;

    commitRouteState(
      {
        ...selectCreatorRoute(routeState, "home"),
        projectId: nextProjectId,
      },
      "push",
    );
  }, [
    commitRouteState,
    collabController.collaborationSession?.scope?.projectId,
    importWorkbenchController.importWorkbench,
    routeState,
    shotWorkbenchController.shotWorkbench,
  ]);

  const sessionLabel = identityOverride
    ? t("session.override.active", {
        orgId: identityOverride.orgId,
        userId: identityOverride.userId,
      })
    : t("session.active", { userId: session?.userId ?? "" });

  const workbenchErrorMessage = routeState.route === "imports"
    ? importWorkbenchController.errorMessage
    : routeState.route === "shots"
      ? shotWorkbenchController.errorMessage
      : routeState.route === "collab"
        ? collabController.errorMessage
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
    const importWorkbench = importWorkbenchController.importWorkbench;

    return (
      <ImportBatchWorkbenchPage
        workbench={importWorkbench}
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        showHeader={false}
        shellHeader={
          <CreatorWorkspaceShell
            tone="imports"
            badge={t("import.badge")}
            title={importWorkbench.importBatch.id}
            description={t("import.header", {
              status: importWorkbench.importBatch.status,
              sourceType: importWorkbench.importBatch.sourceType,
            })}
            sessionLabel={sessionLabel}
            locale={locale}
            t={t}
            onLocaleChange={setLocale}
            onClearSession={
              identityOverride
                ? undefined
                : () => {
                    void handleClearCurrentSession();
                  }
            }
            onBackHome={handleReturnHome}
            feedback={
              importWorkbenchController.feedback ? (
                <ActionFeedback feedback={importWorkbenchController.feedback} />
              ) : undefined
            }
          />
        }
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
    );
  }

  if (shotWorkbenchController.shotWorkbench) {
    const shotWorkbench = shotWorkbenchController.shotWorkbench;

    return (
      <ShotWorkbenchPage
        workbench={shotWorkbench}
        workflowPanel={shotWorkbenchController.shotWorkflowPanel ?? undefined}
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        showHeader={false}
        shellHeader={
          <CreatorWorkspaceShell
            tone="shots"
            badge={t("shot.badge")}
            title={shotWorkbench.shotExecution.id}
            description={t("shot.header", {
              shotId: shotWorkbench.shotExecution.shotId,
              status: shotWorkbench.shotExecution.status,
            })}
            sessionLabel={sessionLabel}
            locale={locale}
            t={t}
            onLocaleChange={setLocale}
            onClearSession={
              identityOverride
                ? undefined
                : () => {
                    void handleClearCurrentSession();
                  }
            }
            onBackHome={handleReturnHome}
            feedback={
              shotWorkbenchController.feedback ? (
                <ActionFeedback feedback={shotWorkbenchController.feedback} />
              ) : undefined
            }
          />
        }
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
    );
  }

  if (routeState.route === "collab" && collabController.collaborationSession) {
    const collaborationSession = collabController.collaborationSession;

    return (
      <CollabWorkbenchPage
        collaborationSession={collaborationSession}
        t={t}
        feedback={collabController.feedback ?? undefined}
        shellHeader={
          <CreatorWorkspaceShell
            tone="collab"
            badge={t("collab.badge")}
            title={collaborationSession.session.ownerId}
            description={t("collab.header", {
              ownerType: collaborationSession.session.ownerType,
              ownerId: collaborationSession.session.ownerId,
              draftVersion: collaborationSession.session.draftVersion,
            })}
            sessionLabel={sessionLabel}
            locale={locale}
            t={t}
            onLocaleChange={setLocale}
            onClearSession={
              identityOverride
                ? undefined
                : () => {
                    void handleClearCurrentSession();
                  }
            }
            onBackHome={handleReturnHome}
            feedback={
              collabController.feedback ? (
                <ActionFeedback feedback={collabController.feedback} />
              ) : undefined
            }
          />
        }
        claimDraftVersionInput={collabController.claimDraftVersionInput}
        conflictSummaryInput={collabController.conflictSummaryInput}
        onClaimDraftVersionInputChange={collabController.setClaimDraftVersionInput}
        onConflictSummaryInputChange={collabController.setConflictSummaryInput}
        onClaimLease={collabController.handleClaimLease}
        onReleaseLease={collabController.handleReleaseLease}
      />
    );
  }

  if (routeState.route === "home") {
    return (
      <CreatorHomePage
        locale={locale}
        t={t}
        onLocaleChange={setLocale}
        showHeader={false}
        shellHeader={
          <CreatorWorkspaceShell
            tone="home"
            badge={t("home.badge")}
            title={t("home.title")}
            description={t("home.description")}
            sessionLabel={sessionLabel}
            locale={locale}
            t={t}
            onLocaleChange={setLocale}
            onClearSession={
              identityOverride
                ? undefined
                : () => {
                    void handleClearCurrentSession();
                  }
            }
          />
        }
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
    );
  }

  if (routeState.route === "imports") {
    return <main style={{ padding: "32px" }}>{t("app.loading.import")}</main>;
  }

  if (routeState.route === "collab") {
    return <main style={{ padding: "32px" }}>{t("app.loading.collab")}</main>;
  }

  return <main style={{ padding: "32px" }}>{t("app.loading.shot")}</main>;
}
