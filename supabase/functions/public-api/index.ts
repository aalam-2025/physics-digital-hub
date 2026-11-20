import { enforceLimit, getAdminClient, identifierHash, jsonResponse } from '../_shared/server.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const browserId = typeof body.browser_id === 'string' ? body.browser_id.slice(0, 256) : '';
    const admin = getAdminClient();

    if (action === 'config') {
      if (!await enforceLimit(admin, request, 'public-config', 120, 600, browserId)) return jsonResponse({ error: 'Please slow down and try again shortly.' }, 429);
      const browserHash = browserId ? await identifierHash(browserId) : '';
      await admin.from('comments').delete().lte('expires_at', new Date().toISOString());
      const [{ data: settings }, { count: likes }, { data: likeRow }, { data: comments }] = await Promise.all([
        admin.from('site_settings').select('active_vimeo_id,active_vimeo_hash,active_mp4_url').eq('id', 1).maybeSingle(),
        admin.from('likes').select('visitor_hash', { count: 'exact', head: true }),
        browserHash ? admin.from('likes').select('visitor_hash').eq('visitor_hash', browserHash).maybeSingle() : Promise.resolve({ data: null }),
        admin.from('comments').select('id,content,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50),
      ]);
      return jsonResponse({
        vimeo_id: settings?.active_vimeo_id ?? '',
        vimeo_hash: settings?.active_vimeo_hash ?? '',
        mp4_url: settings?.active_mp4_url ?? '',
        likes: likes ?? 0,
        has_liked: Boolean(likeRow),
        comments: comments ?? [],
      });
    }

    if (action === 'track') {
      const allowedTypes = ['page_visit', 'page_heartbeat', 'video_play'];
      const eventType = typeof body.event_type === 'string' && allowedTypes.includes(body.event_type) ? body.event_type : '';
      if (!eventType || !browserId) return jsonResponse({ error: 'Invalid analytics event.' }, 400);
      if (!await enforceLimit(admin, request, `track-${eventType}`, 90, 600, browserId)) return jsonResponse({ error: 'Please slow down and try again shortly.' }, 429);
      const visitorHash = await identifierHash(browserId);
      const page = typeof body.page === 'string' && ['welcome', 'video'].includes(body.page) ? body.page : 'public';
      const { error } = await admin.from('analytics_events').insert({ event_type: eventType, visitor_hash: visitorHash, page });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'comments_list') {
      if (!await enforceLimit(admin, request, 'comments-list', 60, 600, browserId)) return jsonResponse({ error: 'Please slow down and try again shortly.' }, 429);
      await admin.from('comments').delete().lte('expires_at', new Date().toISOString());
      const { data, error } = await admin.from('comments').select('id,content,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return jsonResponse({ comments: data ?? [] });
    }

    if (action === 'comment_add') {
      const content = typeof body.content === 'string' ? body.content.trim() : '';
      if (content.length < 2 || content.length > 500 || !browserId) return jsonResponse({ error: 'Comments must contain 2–500 characters.' }, 400);
      if (!await enforceLimit(admin, request, 'comment-add', 3, 600, browserId)) return jsonResponse({ error: 'Please wait before posting another comment.' }, 429);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const { data: savedComment, error } = await admin.from('comments')
        .insert({ content, created_at: now.toISOString(), expires_at: expiresAt.toISOString() })
        .select('id,content,created_at,expires_at')
        .single();
      if (error || !savedComment) throw error ?? new Error('Comment could not be saved.');
      const visitorHash = await identifierHash(browserId);
      const { error: analyticsError } = await admin.from('analytics_events').insert({ event_type: 'comment_post', visitor_hash: visitorHash, page: 'video' });
      if (analyticsError) console.error('Comment analytics event was not recorded:', analyticsError.message);
      return jsonResponse({ ok: true, comment: savedComment }, 201);
    }

    if (action === 'like_toggle') {
      if (!browserId) return jsonResponse({ error: 'Browser identifier is missing.' }, 400);
      if (!await enforceLimit(admin, request, 'like-toggle', 20, 600, browserId)) return jsonResponse({ error: 'Please wait before changing your Like again.' }, 429);
      const visitorHash = await identifierHash(browserId);
      const { data, error } = await admin.rpc('toggle_like', { p_visitor_hash: visitorHash });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return jsonResponse({ liked: Boolean(result?.liked), total_likes: Number(result?.total_likes ?? 0) });
    }

    return jsonResponse({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('public-api error:', error);
    return jsonResponse({ error: 'The public service is temporarily unavailable. Please retry.' }, 500);
  }
});
