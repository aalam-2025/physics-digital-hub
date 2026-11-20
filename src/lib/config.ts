export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabasePublishableKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? '',
  demoMode: (import.meta.env.VITE_DEMO_MODE as string | undefined) !== 'false',
  initialVimeoId: (import.meta.env.VITE_VIMEO_VIDEO_ID as string | undefined)?.trim() ?? '',
  initialVimeoHash: (import.meta.env.VITE_VIMEO_VIDEO_HASH as string | undefined)?.trim() ?? '',
  initialDownloadUrl: (import.meta.env.VITE_GITHUB_DOWNLOAD_URL as string | undefined)?.trim() ?? '',
};

export const hasSupabaseConfig = Boolean(env.supabaseUrl && env.supabasePublishableKey);
export const isDemoMode = env.demoMode || !hasSupabaseConfig;
