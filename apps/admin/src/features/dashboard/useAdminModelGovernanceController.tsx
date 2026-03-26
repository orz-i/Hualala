import { startTransition, useCallback, useEffect, useState } from "react";
import type { AdminTranslator } from "../../i18n";
import type { ModelGovernancePanelViewModel } from "./governance";
import { loadModelGovernancePanel } from "./loadModelGovernancePanel";
import {
	createModelProfile,
	createPromptTemplateVersion,
	setModelProfileStatus,
	setPromptTemplateStatus,
	updateModelProfile,
	updatePromptTemplateDraft,
} from "./mutateModelGovernance";
import { waitForFeedbackPaint } from "./waitForFeedbackPaint";

type IdentityOverride =
	| {
			orgId: string;
			userId: string;
	  }
	| undefined;

type ActionFeedback = {
	tone: "pending" | "success" | "error";
	message: string;
} | null;

export function useAdminModelGovernanceController({
	sessionState,
	enabled,
	identityOverride,
	effectiveOrgId,
	effectiveUserId,
	sessionPermissionCodes,
	projectId,
	shotId,
	shotExecutionId,
	t,
}: {
	sessionState: "loading" | "ready" | "unauthenticated";
	enabled: boolean;
	identityOverride: IdentityOverride;
	effectiveOrgId: string;
	effectiveUserId: string;
	sessionPermissionCodes: string[];
	projectId: string;
	shotId: string;
	shotExecutionId: string;
	t: AdminTranslator;
}) {
	const [modelGovernance, setModelGovernance] = useState<ModelGovernancePanelViewModel | null>(null);
	const [errorMessage, setErrorMessage] = useState("");
	const [modelGovernanceActionFeedback, setModelGovernanceActionFeedback] =
		useState<ActionFeedback>(null);
	const [modelGovernanceActionPending, setModelGovernanceActionPending] = useState(false);
	const sessionPermissionSignature = sessionPermissionCodes.join("|");
	const canWriteModelGovernance = sessionPermissionCodes.includes(
		"org.model_governance.write",
	);

	const refreshModelGovernance = useCallback(async () => {
		if (!enabled || sessionState !== "ready") {
			return;
		}

		const nextPanel = await loadModelGovernancePanel({
			orgId: identityOverride?.orgId,
			userId: identityOverride?.userId,
			projectId,
			shotId,
			shotExecutionId,
			sessionPermissionCodes,
		});
		startTransition(() => {
			setModelGovernance(nextPanel);
			setErrorMessage("");
		});
	}, [
		enabled,
		identityOverride?.orgId,
		identityOverride?.userId,
		projectId,
		sessionPermissionSignature,
		sessionState,
		shotExecutionId,
		shotId,
	]);

	const runAction = useCallback(
		async ({
			pendingMessage,
			successMessage,
			execute,
		}: {
			pendingMessage: string;
			successMessage: string;
			execute: (input: { orgId: string; userId: string }) => Promise<unknown>;
		}) => {
			if (!enabled || modelGovernanceActionPending || !canWriteModelGovernance) {
				return;
			}

			startTransition(() => {
				setModelGovernanceActionPending(true);
				setModelGovernanceActionFeedback({
					tone: "pending",
					message: pendingMessage,
				});
			});

			try {
				await waitForFeedbackPaint();
				await execute({
					orgId: effectiveOrgId,
					userId: effectiveUserId,
				});
				await refreshModelGovernance();
				startTransition(() => {
					setModelGovernanceActionPending(false);
					setModelGovernanceActionFeedback({
						tone: "success",
						message: successMessage,
					});
				});
			} catch (error: unknown) {
				const message =
					error instanceof Error
						? error.message
						: "admin: unknown model governance action error";
				startTransition(() => {
					setModelGovernanceActionPending(false);
					setModelGovernanceActionFeedback({
						tone: "error",
						message: t("governance.model.action.error", { message }),
					});
				});
			}
		},
		[
			effectiveOrgId,
			effectiveUserId,
			enabled,
			modelGovernanceActionPending,
			refreshModelGovernance,
			t,
			canWriteModelGovernance,
		],
	);

	useEffect(() => {
		if (sessionState !== "ready" || !enabled) {
			startTransition(() => {
				setModelGovernance(null);
				setErrorMessage("");
				setModelGovernanceActionFeedback(null);
				setModelGovernanceActionPending(false);
			});
			return;
		}

		let cancelled = false;

		loadModelGovernancePanel({
			orgId: identityOverride?.orgId,
			userId: identityOverride?.userId,
			projectId,
			shotId,
			shotExecutionId,
			sessionPermissionCodes,
		})
			.then((nextPanel) => {
				if (cancelled) {
					return;
				}
				startTransition(() => {
					setModelGovernance(nextPanel);
					setErrorMessage("");
				});
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				const message =
					error instanceof Error ? error.message : "admin: unknown model governance error";
				startTransition(() => {
					setErrorMessage(message);
					setModelGovernance(null);
				});
			});

		return () => {
			cancelled = true;
		};
	}, [
		enabled,
		identityOverride?.orgId,
		identityOverride?.userId,
		projectId,
		sessionPermissionSignature,
		sessionState,
		shotExecutionId,
		shotId,
	]);

	return {
		modelGovernance,
		errorMessage,
		modelGovernanceActionFeedback,
		modelGovernanceActionPending,
		refreshModelGovernance,
		onCreateModelProfile: (input: {
			provider: string;
			modelName: string;
			capabilityType: string;
			region?: string;
			supportedInputLocales: string[];
			supportedOutputLocales: string[];
			pricingSnapshotJson?: string;
			rateLimitPolicyJson?: string;
		}) => {
			void runAction({
				pendingMessage: t("governance.model.action.profile.create.pending"),
				successMessage: t("governance.model.action.profile.create.success"),
				execute: (options) =>
					createModelProfile({
						...options,
						...input,
					}),
			});
		},
		onUpdateModelProfile: (input: {
			modelProfileId: string;
			supportedInputLocales: string[];
			supportedOutputLocales: string[];
			pricingSnapshotJson?: string;
			rateLimitPolicyJson?: string;
		}) => {
			void runAction({
				pendingMessage: t("governance.model.action.profile.update.pending"),
				successMessage: t("governance.model.action.profile.update.success"),
				execute: (options) =>
					updateModelProfile({
						...options,
						...input,
					}),
			});
		},
		onSetModelProfileStatus: (input: { modelProfileId: string; status: string }) => {
			void runAction({
				pendingMessage: t("governance.model.action.profile.status.pending"),
				successMessage: t("governance.model.action.profile.status.success"),
				execute: (options) =>
					setModelProfileStatus({
						...options,
						...input,
					}),
			});
		},
		onCreatePromptTemplateVersion: (input: {
			templateFamily: string;
			templateKey: string;
			locale: string;
			content: string;
			inputSchemaJson?: string;
			outputSchemaJson?: string;
		}) => {
			void runAction({
				pendingMessage: t("governance.model.action.prompt.create.pending"),
				successMessage: t("governance.model.action.prompt.create.success"),
				execute: (options) =>
					createPromptTemplateVersion({
						...options,
						...input,
					}),
			});
		},
		onUpdatePromptTemplateDraft: (input: {
			promptTemplateId: string;
			content: string;
			inputSchemaJson?: string;
			outputSchemaJson?: string;
		}) => {
			void runAction({
				pendingMessage: t("governance.model.action.prompt.update.pending"),
				successMessage: t("governance.model.action.prompt.update.success"),
				execute: (options) =>
					updatePromptTemplateDraft({
						...options,
						...input,
					}),
			});
		},
		onSetPromptTemplateStatus: (input: { promptTemplateId: string; status: string }) => {
			void runAction({
				pendingMessage: t("governance.model.action.prompt.status.pending"),
				successMessage: t("governance.model.action.prompt.status.success"),
				execute: (options) =>
					setPromptTemplateStatus({
						...options,
						...input,
					}),
			});
		},
	};
}
