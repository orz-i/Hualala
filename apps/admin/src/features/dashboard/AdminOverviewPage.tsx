import type { AdminTranslator, LocaleCode } from "../../i18n";
import type { AdminOverviewViewModel } from "./overview";
import { AdminOverviewHeader } from "./overview-page/AdminOverviewHeader";
import { AdminOverviewSummaryPanels } from "./overview-page/AdminOverviewSummaryPanels";
import { type FeedbackMessage } from "./overview-page/shared";

type AdminOverviewPageProps = {
  overview: AdminOverviewViewModel;
  locale: LocaleCode;
  t: AdminTranslator;
  onUpdateBudgetLimit?: (input: { projectId: string; limitCents: number }) => void;
  budgetFeedback?: FeedbackMessage;
};

export function AdminOverviewPage({
  overview,
  locale,
  t,
  onUpdateBudgetLimit,
  budgetFeedback,
}: AdminOverviewPageProps) {
  return (
    <div
      style={{
        width: "min(1280px, 100%)",
        margin: "0 auto",
        display: "grid",
        gap: "24px",
      }}
    >
      <AdminOverviewHeader overview={overview} locale={locale} t={t} />

      <AdminOverviewSummaryPanels
        overview={overview}
        t={t}
        onUpdateBudgetLimit={onUpdateBudgetLimit}
        budgetFeedback={budgetFeedback}
      />
    </div>
  );
}
