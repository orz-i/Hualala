export type UploadSessionResponse = {
  session_id: string;
  import_batch_id?: string;
  status: string;
  retry_count: number;
  resume_hint: string;
  expires_at?: string;
  organization?: string;
  project_id?: string;
  upload_file_id?: string;
  asset_id?: string;
  variant_id?: string;
  candidate_asset_id?: string;
  shot_execution_id?: string;
};

export type CreateUploadSessionInput = {
  organization_id: string;
  project_id: string;
  import_batch_id: string;
  file_name: string;
  checksum: string;
  size_bytes: number;
  expires_in_seconds: number;
};

export type CompleteUploadSessionInput = {
  shot_execution_id: string;
  variant_type: string;
  mime_type: string;
  locale: string;
  rights_status: string;
  ai_annotated: boolean;
  width: number;
  height: number;
};

export type UploadClient = {
  baseUrl: string;
  createSession: (body: CreateUploadSessionInput) => Promise<UploadSessionResponse>;
  getSession: (sessionId: string) => Promise<UploadSessionResponse>;
  retrySession: (sessionId: string) => Promise<UploadSessionResponse>;
  completeSession: (
    sessionId: string,
    body: CompleteUploadSessionInput,
  ) => Promise<UploadSessionResponse>;
};
