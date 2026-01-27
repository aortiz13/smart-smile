'use server';

import { createClient } from '@/utils/supabase/server';
import { SmileSession } from '@/types/gemini';

/**
 * Uploads a file to Supabase Storage.
 * Note: Accepting FormData is necessary for Server Actions handling file uploads.
 */
export const uploadScan = async (formData: FormData): Promise<string> => {
    console.log("[Storage] ENTRY: uploadScan called.");
    try {
        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;

        if (!file || !userId) throw new Error("Missing file or userId");

        const supabase = await createClient();
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('scans')
            .upload(filePath, file);

        if (uploadError) {
            console.error("Supabase Upload Error:", uploadError);
            throw new Error(`Upload Failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('scans').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error: any) {
        console.error("[Storage] uploadScan critical error:", error);
        // Normalize error for client
        throw new Error(`Upload Failed: ${error.message || "Unknown error"}`);
    }
};

/**
 * Saves a generated image URL to Supabase (or re-uploads if needed).
 * In this implementation, we assume the image is already a URL (from Gemini/Veo) 
 * or we might need to fetch and re-upload if we want it in OUR storage.
 * The prototype `uploadGeneratedImage` took base64, fetched it, and uploaded.
 * We can do the same here using Server Actions.
 */
export const uploadGeneratedImage = async (imageUrlOrBase64: string, userId: string, type: string): Promise<string> => {
    try {
        const supabase = await createClient();
        const fileName = `${userId}/${Date.now()}_${type}.png`;

        let blob: Blob;

        if (imageUrlOrBase64.startsWith('data:')) {
            // Base64
            const base64Data = imageUrlOrBase64.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            blob = new Blob([buffer], { type: 'image/png' });
        } else {
            // URL
            const res = await fetch(imageUrlOrBase64);
            blob = await res.blob();
        }

        const { error: uploadError } = await supabase.storage
            .from('generated')
            .upload(fileName, blob, {
                contentType: 'image/png'
            });

        if (uploadError) {
            console.error("Failed to upload generated image:", uploadError);
            return imageUrlOrBase64; // Fallback
        }

        const { data } = supabase.storage.from('generated').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (error) {
        console.error("Critical Error in uploadGeneratedImage:", error);
        return imageUrlOrBase64; // Fail safe return original URL
    }
};

export const saveSession = async (session: SmileSession, userId: string): Promise<void> => {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('sessions')
            .insert({
                id: session.id,
                user_id: userId,
                original_image_url: session.originalImage,
                analysis_data: session.analysis,
                results: session.results,
                created_at: new Date(session.createdAt).toISOString()
            });

        if (error) {
            console.error("Failed to save session:", error);
            // Don't throw, just log. We don't want to break the user flow if saving history fails.
        }
    } catch (error) {
        console.error("Critical Error in saveSession:", error);
    }
};

export const getLastSession = async (userId: string): Promise<SmileSession | null> => {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId) // Check if 'user_id' matches schema column name
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            id: data.id,
            originalImage: data.original_image_url,
            analysis: data.analysis_data,
            results: data.results,
            createdAt: new Date(data.created_at).getTime()
        };
    } catch (error) {
        console.error("Critical Error in getLastSession:", error);
        return null; // Return null safely
    }
};

export const getAllSessions = async (userId: string): Promise<SmileSession[]> => {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error || !data) {
            return [];
        }

        return data.map(row => ({
            id: row.id,
            originalImage: row.original_image_url,
            analysis: row.analysis_data,
            results: row.results,
            createdAt: new Date(row.created_at).getTime()
        }));
    } catch (error) {
        console.error("Critical Error in getAllSessions:", error);
        return [];
    }
};
