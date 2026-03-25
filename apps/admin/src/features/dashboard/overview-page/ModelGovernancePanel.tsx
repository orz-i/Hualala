import { useEffect, useState } from "react";
import type { AdminTranslator } from "../../../i18n";
import type { ModelGovernancePanelViewModel } from "../governance";
import {
	getFeedbackPalette,
	metricStyle,
	panelStyle,
	type FeedbackMessage,
} from "./shared";

type ModelGovernancePanelProps = {
	modelGovernance: ModelGovernancePanelViewModel;
	modelGovernanceActionFeedback?: FeedbackMessage;
	modelGovernanceActionPending?: boolean;
	onCreateModelProfile?: (input: {
		provider: string;
		modelName: string;
		capabilityType: string;
		region?: string;
		supportedInputLocales: string[];
		supportedOutputLocales: string[];
		pricingSnapshotJson?: string;
		rateLimitPolicyJson?: string;
	}) => void;
	onUpdateModelProfile?: (input: {
		modelProfileId: string;
		supportedInputLocales: string[];
		supportedOutputLocales: string[];
		pricingSnapshotJson?: string;
		rateLimitPolicyJson?: string;
	}) => void;
	onSetModelProfileStatus?: (input: { modelProfileId: string; status: string }) => void;
	onCreatePromptTemplateVersion?: (input: {
		templateFamily: string;
		templateKey: string;
		locale: string;
		content: string;
		inputSchemaJson?: string;
		outputSchemaJson?: string;
	}) => void;
	onUpdatePromptTemplateDraft?: (input: {
		promptTemplateId: string;
		content: string;
		inputSchemaJson?: string;
		outputSchemaJson?: string;
	}) => void;
	onSetPromptTemplateStatus?: (input: { promptTemplateId: string; status: string }) => void;
	t: AdminTranslator;
};

const fieldStyle = {
	borderRadius: "12px",
	border: "1px solid rgba(148, 163, 184, 0.45)",
	padding: "10px 12px",
	font: "inherit",
} as const;

const cardStyle = {
	display: "grid",
	gap: "12px",
	padding: "14px 16px",
	borderRadius: "14px",
	background: "rgba(255,255,255,0.86)",
	border: "1px solid rgba(148, 163, 184, 0.18)",
} as const;

function splitValues(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function createProfileDrafts(modelGovernance: ModelGovernancePanelViewModel) {
	return Object.fromEntries(
		modelGovernance.modelProfiles.map((profile) => [
			profile.id,
			{
				supportedInputLocales: profile.supportedInputLocales.join(", "),
				supportedOutputLocales: profile.supportedOutputLocales.join(", "),
				pricingSnapshotJson: profile.pricingSnapshotJson || "{}",
				rateLimitPolicyJson: profile.rateLimitPolicyJson || "{}",
			},
		]),
	);
}

function createPromptDrafts(modelGovernance: ModelGovernancePanelViewModel) {
	return Object.fromEntries(
		modelGovernance.promptTemplates.map((template) => [
			template.id,
			{
				content: template.content,
				inputSchemaJson: template.inputSchemaJson || "{}",
				outputSchemaJson: template.outputSchemaJson || "{}",
			},
		]),
	);
}

export function ModelGovernancePanel({
	modelGovernance,
	modelGovernanceActionFeedback,
	modelGovernanceActionPending,
	onCreateModelProfile,
	onUpdateModelProfile,
	onSetModelProfileStatus,
	onCreatePromptTemplateVersion,
	onUpdatePromptTemplateDraft,
	onSetPromptTemplateStatus,
	t,
}: ModelGovernancePanelProps) {
	const canRead = modelGovernance.capabilities.canReadModelGovernance;
	const canWrite = modelGovernance.capabilities.canWriteModelGovernance;
	const isPending = Boolean(modelGovernanceActionPending);
	const emptyValueLabel = t("governance.model.emptyValue");
	const [newProfileProvider, setNewProfileProvider] = useState("");
	const [newProfileModelName, setNewProfileModelName] = useState("");
	const [newProfileCapabilityType, setNewProfileCapabilityType] = useState("");
	const [newProfileRegion, setNewProfileRegion] = useState("");
	const [newProfileInputLocales, setNewProfileInputLocales] = useState("");
	const [newProfileOutputLocales, setNewProfileOutputLocales] = useState("");
	const [newProfilePricingSnapshot, setNewProfilePricingSnapshot] = useState("{}");
	const [newProfileRateLimitPolicy, setNewProfileRateLimitPolicy] = useState("{}");
	const [profileDrafts, setProfileDrafts] = useState(() =>
		createProfileDrafts(modelGovernance),
	);
	const [newPromptTemplateFamily, setNewPromptTemplateFamily] = useState("");
	const [newPromptTemplateKey, setNewPromptTemplateKey] = useState("");
	const [newPromptLocale, setNewPromptLocale] = useState("zh-CN");
	const [newPromptContent, setNewPromptContent] = useState("");
	const [newPromptInputSchema, setNewPromptInputSchema] = useState("{}");
	const [newPromptOutputSchema, setNewPromptOutputSchema] = useState("{}");
	const [promptDrafts, setPromptDrafts] = useState(() => createPromptDrafts(modelGovernance));
	const [selectedContextBundleId, setSelectedContextBundleId] = useState(
		modelGovernance.contextBundles[0]?.id ?? "",
	);

	useEffect(() => {
		setProfileDrafts(createProfileDrafts(modelGovernance));
	}, [modelGovernance]);

	useEffect(() => {
		setPromptDrafts(createPromptDrafts(modelGovernance));
	}, [modelGovernance]);

	useEffect(() => {
		if (
			selectedContextBundleId &&
			modelGovernance.contextBundles.some((bundle) => bundle.id === selectedContextBundleId)
		) {
			return;
		}
		setSelectedContextBundleId(modelGovernance.contextBundles[0]?.id ?? "");
	}, [modelGovernance.contextBundles, selectedContextBundleId]);

	const selectedContextBundle =
		modelGovernance.contextBundles.find((bundle) => bundle.id === selectedContextBundleId) ??
		null;
	const modelProfileLabels = Object.fromEntries(
		modelGovernance.modelProfiles.map((profile) => [
			profile.id,
			`${profile.provider}/${profile.modelName}`,
		]),
	);
	const promptTemplateLabels = Object.fromEntries(
		modelGovernance.promptTemplates.map((template) => [
			template.id,
			`${template.templateKey} v${template.version} (${template.locale})`,
		]),
	);

	return (
		<>
			<article style={panelStyle}>
				<h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "1.05rem" }}>
					{t("governance.model.title")}
				</h2>
				<p style={{ ...metricStyle, marginBottom: "12px" }}>
					{t("governance.model.summary", {
						projectId: modelGovernance.filters.projectId,
						shotId: modelGovernance.filters.shotId || emptyValueLabel,
						shotExecutionId: modelGovernance.filters.shotExecutionId || emptyValueLabel,
					})}
				</p>
				{modelGovernanceActionFeedback ? (
					<p
						style={{
							marginTop: 0,
							marginBottom: "12px",
							fontSize: "0.9rem",
							...getFeedbackPalette(modelGovernanceActionFeedback),
						}}
					>
						{modelGovernanceActionFeedback.message}
					</p>
				) : null}
				{!canRead ? (
					<p style={{ ...metricStyle, marginBottom: 0 }}>
						{t("governance.model.access.readRequired")}
					</p>
				) : !canWrite ? (
					<p style={{ ...metricStyle, marginBottom: 0 }}>
						{t("governance.model.access.writeDisabled")}
					</p>
				) : null}
			</article>

			{canRead ? (
				<>
					<article style={panelStyle}>
						<h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
							{t("governance.model.profiles.title")}
						</h2>
						<div style={{ display: "grid", gap: "12px" }}>
							<div data-testid="model-profile-create-card" style={cardStyle}>
								<h3 style={{ margin: 0 }}>{t("governance.model.profiles.create.title")}</h3>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.provider")}</span>
									<input
										aria-label={t("governance.model.profiles.provider")}
										value={newProfileProvider}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileProvider(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.modelName")}</span>
									<input
										aria-label={t("governance.model.profiles.modelName")}
										value={newProfileModelName}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileModelName(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.capabilityType")}</span>
									<input
										aria-label={t("governance.model.profiles.capabilityType")}
										value={newProfileCapabilityType}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileCapabilityType(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.region")}</span>
									<input
										aria-label={t("governance.model.profiles.region")}
										value={newProfileRegion}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileRegion(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.supportedInputLocales")}</span>
									<input
										aria-label={t("governance.model.profiles.supportedInputLocales")}
										value={newProfileInputLocales}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileInputLocales(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.supportedOutputLocales")}</span>
									<input
										aria-label={t("governance.model.profiles.supportedOutputLocales")}
										value={newProfileOutputLocales}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileOutputLocales(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.pricingSnapshot")}</span>
									<textarea
										aria-label={t("governance.model.profiles.pricingSnapshot")}
										value={newProfilePricingSnapshot}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfilePricingSnapshot(event.target.value)}
										style={{ ...fieldStyle, minHeight: "72px", resize: "vertical" }}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.profiles.rateLimitPolicy")}</span>
									<textarea
										aria-label={t("governance.model.profiles.rateLimitPolicy")}
										value={newProfileRateLimitPolicy}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewProfileRateLimitPolicy(event.target.value)}
										style={{ ...fieldStyle, minHeight: "72px", resize: "vertical" }}
									/>
								</label>
								<button
									type="button"
									disabled={
										!canWrite ||
										isPending ||
										newProfileProvider.trim() === "" ||
										newProfileModelName.trim() === "" ||
										newProfileCapabilityType.trim() === ""
									}
									onClick={() =>
										onCreateModelProfile?.({
											provider: newProfileProvider.trim(),
											modelName: newProfileModelName.trim(),
											capabilityType: newProfileCapabilityType.trim(),
											region: newProfileRegion.trim(),
											supportedInputLocales: splitValues(newProfileInputLocales),
											supportedOutputLocales: splitValues(newProfileOutputLocales),
											pricingSnapshotJson: newProfilePricingSnapshot.trim() || "{}",
											rateLimitPolicyJson: newProfileRateLimitPolicy.trim() || "{}",
										})
									}
								>
									{t("governance.model.profiles.create.submit")}
								</button>
							</div>

							{modelGovernance.modelProfiles.length === 0 ? (
								<p style={{ ...metricStyle, marginBottom: 0 }}>
									{t("governance.model.profiles.empty")}
								</p>
							) : (
								modelGovernance.modelProfiles.map((profile) => {
									const draft = profileDrafts[profile.id] ?? {
										supportedInputLocales: profile.supportedInputLocales.join(", "),
										supportedOutputLocales: profile.supportedOutputLocales.join(", "),
										pricingSnapshotJson: profile.pricingSnapshotJson || "{}",
										rateLimitPolicyJson: profile.rateLimitPolicyJson || "{}",
									};
									return (
										<div key={profile.id} style={cardStyle}>
											<strong>{profile.provider}/{profile.modelName}</strong>
											<p style={metricStyle}>
												{t("governance.model.profiles.meta.status", {
													status: profile.status,
												})}
											</p>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.profiles.editInputLocales")}</span>
												<input
													value={draft.supportedInputLocales}
													disabled={!canWrite || isPending}
													onChange={(event) =>
														setProfileDrafts((current) => ({
															...current,
															[profile.id]: {
																...draft,
																supportedInputLocales: event.target.value,
															},
														}))
													}
													style={fieldStyle}
												/>
											</label>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.profiles.editOutputLocales")}</span>
												<input
													value={draft.supportedOutputLocales}
													disabled={!canWrite || isPending}
													onChange={(event) =>
														setProfileDrafts((current) => ({
															...current,
															[profile.id]: {
																...draft,
																supportedOutputLocales: event.target.value,
															},
														}))
													}
													style={fieldStyle}
												/>
											</label>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.profiles.editPricingSnapshot")}</span>
												<textarea
													value={draft.pricingSnapshotJson}
													disabled={!canWrite || isPending}
													onChange={(event) =>
														setProfileDrafts((current) => ({
															...current,
															[profile.id]: {
																...draft,
																pricingSnapshotJson: event.target.value,
															},
														}))
													}
													style={{ ...fieldStyle, minHeight: "60px", resize: "vertical" }}
												/>
											</label>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.profiles.editRateLimitPolicy")}</span>
												<textarea
													value={draft.rateLimitPolicyJson}
													disabled={!canWrite || isPending}
													onChange={(event) =>
														setProfileDrafts((current) => ({
															...current,
															[profile.id]: {
																...draft,
																rateLimitPolicyJson: event.target.value,
															},
														}))
													}
													style={{ ...fieldStyle, minHeight: "60px", resize: "vertical" }}
												/>
											</label>
											<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
												<button
													type="button"
													disabled={!canWrite || isPending}
													onClick={() =>
														onUpdateModelProfile?.({
															modelProfileId: profile.id,
															supportedInputLocales: splitValues(
																draft.supportedInputLocales,
															),
															supportedOutputLocales: splitValues(
																draft.supportedOutputLocales,
															),
															pricingSnapshotJson:
																draft.pricingSnapshotJson.trim() || "{}",
															rateLimitPolicyJson:
																draft.rateLimitPolicyJson.trim() || "{}",
														})
													}
												>
													{t("governance.model.profiles.action.save", { id: profile.id })}
												</button>
												<button
													type="button"
													disabled={!canWrite || isPending || profile.status === "paused"}
													onClick={() =>
														onSetModelProfileStatus?.({
															modelProfileId: profile.id,
															status: "paused",
														})
													}
												>
													{t("governance.model.profiles.action.pause", { id: profile.id })}
												</button>
												<button
													type="button"
													disabled={!canWrite || isPending || profile.status === "active"}
													onClick={() =>
														onSetModelProfileStatus?.({
															modelProfileId: profile.id,
															status: "active",
														})
													}
												>
													{t("governance.model.profiles.action.activate", { id: profile.id })}
												</button>
												<button
													type="button"
													disabled={!canWrite || isPending || profile.status === "archived"}
													onClick={() =>
														onSetModelProfileStatus?.({
															modelProfileId: profile.id,
															status: "archived",
														})
													}
												>
													{t("governance.model.profiles.action.archive", { id: profile.id })}
												</button>
											</div>
										</div>
									);
								})
							)}
						</div>
					</article>

					<article style={panelStyle}>
						<h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
							{t("governance.model.prompts.title")}
						</h2>
						<div style={{ display: "grid", gap: "12px" }}>
							<div data-testid="prompt-template-create-card" style={cardStyle}>
								<h3 style={{ margin: 0 }}>{t("governance.model.prompts.create.title")}</h3>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.prompts.templateFamily")}</span>
									<input
										aria-label={t("governance.model.prompts.templateFamily")}
										value={newPromptTemplateFamily}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewPromptTemplateFamily(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.prompts.templateKey")}</span>
									<input
										aria-label={t("governance.model.prompts.templateKey")}
										value={newPromptTemplateKey}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewPromptTemplateKey(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.prompts.locale")}</span>
									<input
										aria-label={t("governance.model.prompts.locale")}
										value={newPromptLocale}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewPromptLocale(event.target.value)}
										style={fieldStyle}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.prompts.content")}</span>
									<textarea
										aria-label={t("governance.model.prompts.content")}
										value={newPromptContent}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewPromptContent(event.target.value)}
										style={{ ...fieldStyle, minHeight: "88px", resize: "vertical" }}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.prompts.inputSchema")}</span>
									<textarea
										aria-label={t("governance.model.prompts.inputSchema")}
										value={newPromptInputSchema}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewPromptInputSchema(event.target.value)}
										style={{ ...fieldStyle, minHeight: "60px", resize: "vertical" }}
									/>
								</label>
								<label style={{ display: "grid", gap: "6px" }}>
									<span>{t("governance.model.prompts.outputSchema")}</span>
									<textarea
										aria-label={t("governance.model.prompts.outputSchema")}
										value={newPromptOutputSchema}
										disabled={!canWrite || isPending}
										onChange={(event) => setNewPromptOutputSchema(event.target.value)}
										style={{ ...fieldStyle, minHeight: "60px", resize: "vertical" }}
									/>
								</label>
								<button
									type="button"
									disabled={
										!canWrite ||
										isPending ||
										newPromptTemplateFamily.trim() === "" ||
										newPromptTemplateKey.trim() === "" ||
										newPromptContent.trim() === ""
									}
									onClick={() =>
										onCreatePromptTemplateVersion?.({
											templateFamily: newPromptTemplateFamily.trim(),
											templateKey: newPromptTemplateKey.trim(),
											locale: newPromptLocale.trim() || "zh-CN",
											content: newPromptContent.trim(),
											inputSchemaJson: newPromptInputSchema.trim() || "{}",
											outputSchemaJson: newPromptOutputSchema.trim() || "{}",
										})
									}
								>
									{t("governance.model.prompts.create.submit")}
								</button>
							</div>

							{modelGovernance.promptTemplates.length === 0 ? (
								<p style={{ ...metricStyle, marginBottom: 0 }}>
									{t("governance.model.prompts.empty")}
								</p>
							) : (
								modelGovernance.promptTemplates.map((template) => {
									const draft = promptDrafts[template.id] ?? {
										content: template.content,
										inputSchemaJson: template.inputSchemaJson || "{}",
										outputSchemaJson: template.outputSchemaJson || "{}",
									};
									const draftEditable = template.status === "draft";
									return (
										<div
											key={template.id}
											data-testid={`prompt-template-card-${template.id}`}
											style={cardStyle}
										>
											<strong>
												{template.templateKey} v{template.version} ({template.locale})
											</strong>
											<p style={metricStyle}>
												{t("governance.model.prompts.meta.status", {
													status: template.status,
												})}
											</p>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.prompts.editContent")}</span>
												<textarea
													aria-label={t("governance.model.prompts.contentFor", {
														id: template.id,
													})}
													value={draft.content}
													disabled={!draftEditable || !canWrite || isPending}
													onChange={(event) =>
														setPromptDrafts((current) => ({
															...current,
															[template.id]: {
																...draft,
																content: event.target.value,
															},
														}))
													}
													style={{ ...fieldStyle, minHeight: "88px", resize: "vertical" }}
												/>
											</label>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.prompts.editInputSchema")}</span>
												<textarea
													aria-label={`${t("governance.model.prompts.inputSchema")} ${template.id}`}
													value={draft.inputSchemaJson}
													disabled={!draftEditable || !canWrite || isPending}
													onChange={(event) =>
														setPromptDrafts((current) => ({
															...current,
															[template.id]: {
																...draft,
																inputSchemaJson: event.target.value,
															},
														}))
													}
													style={{ ...fieldStyle, minHeight: "60px", resize: "vertical" }}
												/>
											</label>
											<label style={{ display: "grid", gap: "6px" }}>
												<span>{t("governance.model.prompts.editOutputSchema")}</span>
												<textarea
													aria-label={`${t("governance.model.prompts.outputSchema")} ${template.id}`}
													value={draft.outputSchemaJson}
													disabled={!draftEditable || !canWrite || isPending}
													onChange={(event) =>
														setPromptDrafts((current) => ({
															...current,
															[template.id]: {
																...draft,
																outputSchemaJson: event.target.value,
															},
														}))
													}
													style={{ ...fieldStyle, minHeight: "60px", resize: "vertical" }}
												/>
											</label>
											{!draftEditable ? (
												<p style={{ ...metricStyle, marginBottom: 0 }}>
													{t("governance.model.prompts.readOnlyActive")}
												</p>
											) : null}
											<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
												<button
													type="button"
													disabled={!draftEditable || !canWrite || isPending}
													onClick={() =>
														onUpdatePromptTemplateDraft?.({
															promptTemplateId: template.id,
															content: draft.content,
															inputSchemaJson: draft.inputSchemaJson.trim() || "{}",
															outputSchemaJson:
																draft.outputSchemaJson.trim() || "{}",
														})
													}
												>
													{t("governance.model.prompts.action.updateDraft", {
														id: template.id,
													})}
												</button>
												<button
													type="button"
													disabled={!draftEditable || !canWrite || isPending}
													onClick={() =>
														onSetPromptTemplateStatus?.({
															promptTemplateId: template.id,
															status: "active",
														})
													}
												>
													{t("governance.model.prompts.action.publish", { id: template.id })}
												</button>
												<button
													type="button"
													disabled={!canWrite || isPending || template.status === "archived"}
													onClick={() =>
														onSetPromptTemplateStatus?.({
															promptTemplateId: template.id,
															status: "archived",
														})
													}
												>
													{t("governance.model.prompts.action.archive", { id: template.id })}
												</button>
											</div>
										</div>
									);
								})
							)}
						</div>
					</article>

					<article style={panelStyle}>
						<h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.05rem" }}>
							{t("governance.model.context.title")}
						</h2>
						<p style={{ ...metricStyle, marginBottom: "12px" }}>
							{t("governance.model.context.summary", {
								projectId: modelGovernance.filters.projectId,
								shotId: modelGovernance.filters.shotId || emptyValueLabel,
								shotExecutionId: modelGovernance.filters.shotExecutionId || emptyValueLabel,
							})}
						</p>
						<div style={{ display: "grid", gap: "12px" }}>
							{modelGovernance.contextBundles.length === 0 ? (
								<p style={{ ...metricStyle, marginBottom: 0 }}>
									{t("governance.model.context.empty")}
								</p>
							) : (
								modelGovernance.contextBundles.map((bundle) => (
									<div key={bundle.id} style={cardStyle}>
										<strong>{bundle.id}</strong>
										<p style={metricStyle}>
											{bundle.projectId} / {bundle.shotId} / {bundle.shotExecutionId}
										</p>
										<p style={metricStyle}>
											{modelProfileLabels[bundle.modelProfileId] ?? bundle.modelProfileId}
										</p>
										<p style={metricStyle}>
											{promptTemplateLabels[bundle.promptTemplateId] ??
												bundle.promptTemplateId}
										</p>
										<button
											type="button"
											onClick={() => setSelectedContextBundleId(bundle.id)}
										>
											{t("governance.model.context.action.view", { id: bundle.id })}
										</button>
									</div>
								))
							)}
							{selectedContextBundle ? (
								<div data-testid="context-bundle-detail" style={cardStyle}>
									<h3 style={{ margin: 0 }}>{t("governance.model.context.detail.title")}</h3>
									<p style={metricStyle}>
										{t("governance.model.context.detail.scope", {
											projectId: selectedContextBundle.projectId,
											shotId: selectedContextBundle.shotId,
											shotExecutionId: selectedContextBundle.shotExecutionId,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.modelProfile", {
											modelProfile:
												modelProfileLabels[selectedContextBundle.modelProfileId] ??
												selectedContextBundle.modelProfileId,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.promptTemplate", {
											promptTemplate:
												promptTemplateLabels[selectedContextBundle.promptTemplateId] ??
												selectedContextBundle.promptTemplateId,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.locales", {
											inputLocale: selectedContextBundle.inputLocale,
											outputLocale: selectedContextBundle.outputLocale,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.sourceSnapshots", {
											sourceSnapshots:
												selectedContextBundle.sourceSnapshotIds.join(", ") ||
												emptyValueLabel,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.referencedAssets", {
											referencedAssets:
												selectedContextBundle.referencedAssetIds.join(", ") ||
												emptyValueLabel,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.createdBy", {
											userId: selectedContextBundle.createdByUserId,
										})}
									</p>
									<p style={metricStyle}>
										{t("governance.model.context.detail.createdAt", {
											createdAt: selectedContextBundle.createdAt || "pending",
										})}
									</p>
									<pre
										style={{
											margin: 0,
											padding: "12px",
											borderRadius: "14px",
											background: "#0f172a",
											color: "#e2e8f0",
											overflowX: "auto",
											fontSize: "0.85rem",
										}}
									>
										{selectedContextBundle.payloadJson}
									</pre>
								</div>
							) : null}
						</div>
					</article>
				</>
			) : null}
		</>
	);
}
