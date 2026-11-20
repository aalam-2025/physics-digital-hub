import { getAdminClient, jsonResponse, cleanString, isHttpsUrl, verifyGateToken } from '../_shared/server.ts';

const ALLOWED_DAYS = new Set([7, 30, 90]);

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-member-gate', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const authorization = request.headers.get('authorization') ?? '';
    const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
    const gateToken = request.headers.get('x-member-gate') ?? '';
    if (!accessToken) return jsonResponse({ error: 'Sign in to a project member account first.' }, 401);
    if (!await verifyGateToken(gateToken)) return jsonResponse({ error: 'The shared-password session expired. Please verify the shared password again.' }, 401);

    const admin = getAdminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user) return jsonResponse({ error: 'Your member session is invalid. Please sign in again.' }, 401);
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,member_code,display_name,role').eq('auth_user_id', authData.user.id).maybeSingle();
    if (profileError || !profile) return jsonResponse({ error: 'This account is not registered as a project member.' }, 403);

    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action.slice(0, 40) : '';
    const { data: allowed, error: limitError } = await admin.rpc('consume_rate_limit', { p_bucket_key: `member:${authData.user.id}:${action}`, p_limit: 180, p_window_seconds: 600 });
    if (limitError) throw new Error('Member request protection is temporarily unavailable.');
    if (!allowed) return jsonResponse({ error: 'Please slow down and try again shortly.' }, 429);
    const isAdmin = profile.role === 'admin';

    if (action === 'dashboard') {
      const daysInput = Number(body.days ?? 30);
      const days = ALLOWED_DAYS.has(daysInput) ? daysInput : 30;
      await admin.from('comments').delete().lte('expires_at', new Date().toISOString());
      const [membersResult, settingsResult, commentsResult, analyticsResult, likesResult] = await Promise.all([
        admin.from('profiles').select('id,member_code,display_name,email_alias,role').order('member_code'),
        admin.from('site_settings').select('active_vimeo_id,active_vimeo_hash,active_mp4_url,announcement,exhibition_info').eq('id', 1).maybeSingle(),
        admin.from('comments').select('id,content,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(500),
        admin.rpc('get_analytics_summary', { p_days: days }),
        admin.from('likes').select('visitor_hash', { count: 'exact', head: true }),
      ]);
      if (membersResult.error || settingsResult.error || commentsResult.error || analyticsResult.error || likesResult.error) throw new Error('Dashboard data could not be loaded.');
      const summary = (analyticsResult.data ?? {}) as Record<string, unknown>;
      const analytics = (summary.analytics ?? {}) as Record<string, number>;
      return jsonResponse({
        profile: { id: profile.id, display_name: profile.display_name, role: profile.role },
        members: (membersResult.data ?? []).map((member) => ({ id: member.id, member_code: member.member_code, display_name: member.display_name, email_alias: member.email_alias, role: member.role })),
        settings: settingsResult.data ?? { active_vimeo_id: '', active_vimeo_hash: '', active_mp4_url: '', announcement: '', exhibition_info: '' },
        comments: commentsResult.data ?? [],
        analytics: {
          visits: Number(analytics.visits ?? 0),
          uniqueVisitors: Number(analytics.uniqueVisitors ?? 0),
          plays: Number(analytics.plays ?? 0),
          uniqueViewers: Number(analytics.uniqueViewers ?? 0),
          likes: likesResult.count ?? 0,
          comments: Number(analytics.comments ?? 0),
          liveVisitorsEstimate: Number(analytics.liveVisitorsEstimate ?? 0),
        },
        daily: Array.isArray(summary.daily) ? summary.daily : [],
        events: Array.isArray(summary.events) ? summary.events : [],
      });
    }

    if (action === 'delete_comment') {
      const commentId = cleanString(body.comment_id, 64);
      if (!/^[0-9a-f-]{36}$/i.test(commentId)) return jsonResponse({ error: 'Invalid comment identifier.' }, 400);
      const { data: deleted, error: deleteError } = await admin.from('comments').delete().eq('id', commentId).select('id').maybeSingle();
      if (deleteError) throw deleteError;
      if (!deleted) return jsonResponse({ error: 'This comment may already have expired or been deleted.' }, 404);
      const { error: auditError } = await admin.from('comment_deletion_audit').insert({ comment_id: commentId, deleted_by_profile_id: profile.id, deleted_by_name: profile.display_name });
      if (auditError) console.error('Comment deletion audit could not be recorded:', auditError.message);
      return jsonResponse({ ok: true });
    }

    if (action === 'update_settings') {
      if (!isAdmin) return jsonResponse({ error: 'Only Aman Alam can update website settings.' }, 403);
      const settings = (body.settings ?? {}) as Record<string, unknown>;
      const vimeoId = cleanString(settings.active_vimeo_id, 32);
      const vimeoHash = cleanString(settings.active_vimeo_hash, 64);
      const mp4Url = cleanString(settings.active_mp4_url, 2048);
      const announcement = cleanString(settings.announcement, 1000);
      const exhibitionInfo = cleanString(settings.exhibition_info, 2500);
      if (vimeoId && !/^\d{5,20}$/.test(vimeoId)) return jsonResponse({ error: 'Enter a valid numeric Vimeo video ID.' }, 400);
      if (vimeoHash && !/^[a-zA-Z0-9]{4,64}$/.test(vimeoHash)) return jsonResponse({ error: 'The Vimeo privacy hash format is invalid.' }, 400);
      if (mp4Url && !isHttpsUrl(mp4Url)) return jsonResponse({ error: 'The MP4 download link must use HTTPS.' }, 400);
      const { error } = await admin.from('site_settings').update({ active_vimeo_id: vimeoId, active_vimeo_hash: vimeoHash, active_mp4_url: mp4Url, announcement, exhibition_info: exhibitionInfo, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'clear_analytics') {
      if (!isAdmin) return jsonResponse({ error: 'Only Aman Alam can clear analytics.' }, 403);
      const { error } = await admin.from('analytics_events').delete().gte('id', 0);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === 'project_backup') {
      if (!isAdmin) return jsonResponse({ error: 'Only Aman Alam can create a full project backup.' }, 403);
      const [settingsResult, membersResult] = await Promise.all([
        admin.from('site_settings').select('active_vimeo_id,active_vimeo_hash,active_mp4_url,announcement,exhibition_info,updated_at').eq('id', 1).maybeSingle(),
        admin.from('profiles').select('member_code,display_name,email_alias,role,created_at').order('member_code'),
      ]);
      if (settingsResult.error || membersResult.error) throw new Error('Project backup could not be prepared.');
      const activeCommentRows: { id: string; content: string; created_at: string; expires_at: string }[] = [];
      let commentsTruncated = false;
      for (let offset = 0; offset < 20000; offset += 1000) {
        const { data, error } = await admin.from('comments').select('id,content,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).range(offset, offset + 999);
        if (error) throw error;
        activeCommentRows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
        if (offset === 19000) commentsTruncated = true;
      }
      const analyticsRows: { event_type: string; visitor_hash: string; page: string; created_at: string }[] = [];
      let analyticsTruncated = false;
      for (let offset = 0; offset < 50000; offset += 1000) {
        const { data, error } = await admin.from('analytics_events').select('event_type,visitor_hash,page,created_at').order('id').range(offset, offset + 999);
        if (error) throw error;
        analyticsRows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
        if (offset === 49000) analyticsTruncated = true;
      }
      const likeRows: { visitor_hash: string; created_at: string }[] = [];
      let likesTruncated = false;
      for (let offset = 0; offset < 50000; offset += 1000) {
        const { data, error } = await admin.from('likes').select('visitor_hash,created_at').order('created_at', { ascending: true }).range(offset, offset + 999);
        if (error) throw error;
        likeRows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
        if (offset === 49000) likesTruncated = true;
      }
      const deletionRows: { comment_id: string; deleted_by_name: string; deleted_at: string }[] = [];
      let deletionAuditTruncated = false;
      for (let offset = 0; offset < 20000; offset += 1000) {
        const { data, error } = await admin.from('comment_deletion_audit').select('comment_id,deleted_by_name,deleted_at').order('deleted_at', { ascending: false }).range(offset, offset + 999);
        if (error) throw error;
        deletionRows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
        if (offset === 19000) deletionAuditTruncated = true;
      }
      return jsonResponse({
        backup_version: 2,
        created_at: new Date().toISOString(),
        note: 'Contains project data and hashed analytics/Like identifiers, but never contains passwords, access tokens, or authentication secrets.',
        settings: settingsResult.data,
        members: membersResult.data ?? [],
        active_comments: activeCommentRows,
        comment_deletion_audit: deletionRows,
        analytics_events: analyticsRows,
        likes: likeRows,
        analytics_events_truncated: analyticsTruncated,
        comment_deletion_audit_truncated: deletionAuditTruncated,
        comments_truncated: commentsTruncated,
        likes_truncated: likesTruncated,
      });
    }

    if (action === 'export_analytics') {
      const daysInput = Number(body.days ?? 30);
      const days = ALLOWED_DAYS.has(daysInput) ? daysInput : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const rows: { event_type: string; page: string; created_at: string }[] = [];
      let truncated = false;
      for (let offset = 0; offset < 100000; offset += 1000) {
        const { data, error } = await admin.from('analytics_events').select('event_type,page,created_at').gte('created_at', since).order('id', { ascending: true }).range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
        if (offset === 99000) truncated = true;
      }
      return jsonResponse({ events: rows, truncated });
    }

    return jsonResponse({ error: 'Unknown member action.' }, 400);
  } catch (error) {
    console.error('member-api error:', error);
    return jsonResponse({ error: 'The member service is temporarily unavailable. Please retry.' }, 500);
  }
});
