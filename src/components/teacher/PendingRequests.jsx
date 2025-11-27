// src/components/teacher/PendingRequests.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

/**
 * PendingRequests
 * - Shows pending join requests (join_requests.status = 'pending')
 * - Joins classes (class name/code) and profiles (student name/email) via student_id
 * - Approve -> calls approve_join_request(req_id) RPC
 * - Reject  -> calls reject_join_request(req_id, note) RPC
 *
 * Notes:
 * - RLS and RPCs should enforce authorization server-side; this component just provides a UI.
 * - It subscribes to realtime changes on join_requests to keep the list fresh.
 */
export default function PendingRequests({ onApproved }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestLoadingMap, setRequestLoadingMap] = useState({}); // { [reqId]: boolean }

  useEffect(() => {
    loadRequests();

    // subscribe to realtime changes so teacher sees new requests immediately
    const channel = supabase
      .channel('pending-join-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'join_requests' },
        payload => {
          // simple approach: reload on any change (could optimize by delta if needed)
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      // select pending requests joining classes and profiles (student_id)
      const { data, error } = await supabase
        .from('join_requests')
        .select(`
          id,
          class_id,
          student_id,
          message,
          status,
          created_at,
          updated_at,
          classes:class_id ( id, name, class_code, teacher_id ),
          profiles:student_id ( id, full_name, email )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // client-side filter: only show requests whose class belongs to the currently logged-in teacher
      const { data: userData } = await supabase.auth.getUser();
      const currentTeacherId = userData?.data?.user?.id || null;

      const filtered = (data || []).filter((r) => {
        // if classes is populated and teacher_id exists, check it; otherwise keep the row (policy will protect rows)
        if (r.classes && r.classes.teacher_id) {
          return r.classes.teacher_id === currentTeacherId;
        }
        // if classes not populated, allow (server RLS will still prevent incorrect rows)
        return true;
      });

      setRequests(filtered);
    } catch (err) {
      console.error('Error loading pending requests:', err);
      alert('Unable to load pending requests. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const setReqLoading = (reqId, value) =>
    setRequestLoadingMap((m) => ({ ...m, [reqId]: value }));

  const approveRequest = async (reqId) => {
    if (!confirm('Approve this join request?')) return;
    setReqLoading(reqId, true);
    try {
      const { data, error } = await supabase.rpc('approve_join_request', { req_id: reqId });
      if (error) throw error;

      if (data?.status === 'ok' || data?.message === 'approved') {
        alert('Request approved.');
        loadRequests();
        onApproved?.();
      } else {
        // RPC returned something unexpected; still refresh
        console.warn('approve_join_request RPC response:', data);
        alert(data?.message || 'Approved (unexpected RPC response).');
        loadRequests();
        onApproved?.();
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Error approving request. See console for details.');
    } finally {
      setReqLoading(reqId, false);
    }
  };

  const rejectRequest = async (reqId) => {
    const note = prompt('Optional note to student (reason for rejection):', '') ?? null;
    if (note === null && !confirm('Reject this request without a note?')) return;
    setReqLoading(reqId, true);
    try {
      const { data, error } = await supabase.rpc('reject_join_request', { req_id: reqId, note });
      if (error) throw error;

      if (data?.status === 'ok' || data?.message === 'rejected') {
        alert('Request rejected.');
        loadRequests();
      } else {
        console.warn('reject_join_request RPC response:', data);
        alert(data?.message || 'Rejected (unexpected RPC response).');
        loadRequests();
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Error rejecting request. See console for details.');
    } finally {
      setReqLoading(reqId, false);
    }
  };

  if (loading) return <p>Loading pending requests...</p>;

  return (
    <div className="pending-requests">
      <h2>Pending Join Requests</h2>

      {requests.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <div className="requests-list">
          {requests.map((r) => {
            const studentName = r.profiles?.full_name || r.profiles?.email || r.student_id;
            const className = r.classes?.name || r.class_id;
            const classCode = r.classes?.class_code || '—';
            const isLoading = !!requestLoadingMap[r.id];

            return (
              <div key={r.id} className="request-card" style={{
                border: '1px solid #e5e7eb',
                padding: 12,
                borderRadius: 8,
                marginBottom: 10,
                background: '#fff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{className} <small style={{ color: '#6b7280' }}>({classCode})</small></div>
                    <div style={{ color: '#374151' }}>{studentName}</div>
                    <div style={{ color: '#6b7280', marginTop: 6 }}>{r.message || '—'}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Requested: {new Date(r.created_at).toLocaleString()}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => approveRequest(r.id)}
                      disabled={isLoading}
                      style={{ padding: '8px 12px', cursor: isLoading ? 'not-allowed' : 'pointer' }}
                    >
                      {isLoading ? '...' : 'Approve'}
                    </button>

                    <button
                      onClick={() => rejectRequest(r.id)}
                      disabled={isLoading}
                      style={{ padding: '8px 12px', cursor: isLoading ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #e5e7eb' }}
                    >
                      {isLoading ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
