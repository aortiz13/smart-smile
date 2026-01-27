export type Logger = (message: string, type?: LogType) => void;
export type LogType = 'info' | 'success' | 'error' | 'process' | 'warning';

export interface LogEntry {
    id: string;
    timestamp: number;
    message: string;
    type: LogType;
}

export enum VariationType {
    ORIGINAL_BG = "original_bg",
    LIFESTYLE_SOCIAL = "lifestyle_social",
    LIFESTYLE_OUTDOOR = "lifestyle_outdoor"
}

export interface PromptData {
    Subject: string;
    Composition: string;
    Action: string;
    Location: string;
    Style: string;
    Editing_Instructions: string;
    Refining_Details?: string;
    Reference_Instructions?: string;
}

export interface Variation {
    type: VariationType;
    prompt_data: PromptData;
}

export interface AnalysisResponse {
    variations: Variation[];
}

export interface GeneratedImage {
    id: string;
    type: VariationType;
    url: string;
    prompt: string;
    videoUrl?: string;
}

export interface SmileSession {
    id: string;
    user_id?: string;
    originalImage: string;
    analysis: AnalysisResponse;
    results: GeneratedImage[];
    createdAt: number;
}

export enum AppStatus {
    IDLE = "IDLE",
    ANALYZING = "ANALYZING",
    GENERATING = "GENERATING",
    COMPLETED = "COMPLETED",
    ERROR = "ERROR"
}
