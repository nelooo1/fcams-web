
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  LogOut,
  RefreshCw,
  Wrench,
  ClipboardList,
  Check,
  RotateCcw,
  X,
} from 'lucide-react';

import { supabase } from '../config/supabase';

export default function StaffDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [assets, setAssets] = useState([]);
  const [reports, setReports] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [returnAssignment, setReturnAssignment] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    initializeDashboard();
  }, []);

  async function initializeDashboard() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      navigate('/sign-in');
      return;
    }

    setUser(session.user);

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError || !userProfile) {
      setError('Unable to load your profile.');
      setLoading(false);
      return;
    }

    if (String(userProfile.role).toLowerCase() !== 'staff') {
      navigate('/sign-in');
      return;
    }

    setProfile(userProfile);
    await loadStaffData(session.user.id);
  }

  async function loadStaffData(userId = user?.id) {
    if (!userId) return;

    setLoading(true);
    setError('');

    try {
      const { data: assignments, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          id,
          asset_id,
          assigned_at,
          notes,
          is_active,
          assets (
            id,
            asset_tag,
            name,
            status,
            condition
          )
        `)
        .eq('staff_id', userId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (assignmentError) throw assignmentError;

      setAssets(assignments || []);

      const { data: maintenanceReports, error: reportsError } =
        await supabase
          .from('maintenance_records')
          .select(`
            id,
            asset_id,
            issue_description,
            status,
            reported_at,
            action_taken,
            pickup_status,
            pickup_requested_at,
            pickup_approved_at,
            picked_up_at,
            repair_started_at,
            repair_completed_at,
            returned_at,
            technician_id,
            technician:profiles!maintenance_records_technician_id_fkey (
              full_name
            ),
            assets (
              id,
              asset_tag,
              name
            )
          `)
          .order('reported_at', { ascending: false });

      if (reportsError) throw reportsError;

      setReports(maintenanceReports || []);

      const { data: requests, error: returnError } = await supabase
        .from('asset_return_requests')
        .select(`
          id,
          assignment_id,
          asset_id,
          reason,
          status,
          requested_at,
          received_at
        `)
        .eq('staff_id', userId)
        .order('requested_at', { ascending: false });

      if (returnError) throw returnError;

      setReturnRequests(requests || []);
    } catch (err) {
      console.error('Staff dashboard loading error:', err);
      setError(err.message || 'Unable to load dashboard information.');
    } finally {
      setLoading(false);
    }
  }

  async function reportIssue(e) {
    e.preventDefault();

    if (!selectedAsset || !issueDescription.trim()) {
      setError('Select an asset and describe the problem.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { error: insertError } = await supabase
        .from('maintenance_records')
        .insert({
          asset_id: selectedAsset,
          issue_description: issueDescription.trim(),
          reported_by: user.id,
          status: 'Open',
        });

      if (insertError) throw insertError;

      setMessage('Maintenance issue reported successfully.');
      setSelectedAsset('');
      setIssueDescription('');

      await loadStaffData(user.id);
    } catch (err) {
      setError(err.message || 'Unable to submit maintenance report.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReturnRequest(e) {
    e.preventDefault();

    if (!returnAssignment || !returnReason.trim()) {
      setError('Please provide a reason for returning the asset.');
      return;
    }

    setReturnSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { error: insertError } = await supabase
        .from('asset_return_requests')
        .insert({
          assignment_id: returnAssignment.id,
          asset_id: returnAssignment.asset_id,
          staff_id: user.id,
          reason: returnReason.trim(),
        });

      if (insertError) throw insertError;

      setMessage(
        'Asset return request submitted successfully. Please wait for the Administrator to confirm receipt.'
      );

      setReturnAssignment(null);
      setReturnReason('');

      await loadStaffData(user.id);
    } catch (err) {
      setError(err.message || 'Unable to submit asset return request.');
    } finally {
      setReturnSubmitting(false);
    }
  }

  async function approvePickup(recordId) {
    const confirmed = window.confirm(
      'Approve the Technician to collect this asset for maintenance?'
    );

    if (!confirmed) return;

    setProcessingId(recordId);
    setError('');
    setMessage('');

    try {
      const { error: approvalError } = await supabase.rpc(
        'approve_fcams_pickup',
        {
          p_record_id: recordId,
        }
      );

      if (approvalError) throw approvalError;

      setMessage('Pickup request approved successfully.');
      await loadStaffData(user.id);
    } catch (err) {
      setError(err.message || 'Unable to approve pickup request.');
    } finally {
      setProcessingId(null);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/sign-in');
  }

  function formatDate(date) {
    if (!date) return 'Not yet recorded';

    return new Date(date).toLocaleString();
  }

  function statusClass(status) {
    const value = String(status || '').toLowerCase();

    if (
      value === 'closed' ||
      value === 'returned' ||
      value === 'approved' ||
      value === 'received'
    ) {
      return 'bg-green-100 text-green-700';
    }

    if (value === 'in progress' || value === 'picked up') {
      return 'bg-purple-100 text-purple-700';
    }

    if (
      value === 'awaiting approval' ||
      value === 'open' ||
      value === 'pending'
    ) {
      return 'bg-yellow-100 text-yellow-700';
    }

    return 'bg-gray-100 text-gray-700';
  }

  const assignedAssetIds = new Set(
    assets.map((assignment) => assignment.asset_id)
  );

  const pendingPickupReports = reports.filter(
    (report) =>
      report.pickup_status === 'Awaiting Approval' &&
      assignedAssetIds.has(report.asset_id)
  );

  const pendingReturnCount = returnRequests.filter(
    (request) => request.status === 'Pending'
  ).length;

  function getReturnRequest(assignmentId) {
    return returnRequests.find(
      (request) => request.assignment_id === assignmentId
    );
  }

  if (loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="animate-spin text-purple-700" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-purple-800">
              Staff Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Welcome, {profile?.full_name || 'Staff Member'}
            </p>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-600 hover:text-purple-700"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-red-50 text-red-700 flex gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {message && (
          <div className="p-4 rounded-lg bg-green-50 text-green-700 flex gap-2">
            <CheckCircle size={20} />
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-center">
              <p className="text-gray-500 text-sm">Assigned Assets</p>
              <Package className="text-purple-700" />
            </div>
            <p className="text-3xl font-bold mt-3">{assets.length}</p>
          </div>

          <div className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-center">
              <p className="text-gray-500 text-sm">My Maintenance Reports</p>
              <Wrench className="text-purple-700" />
            </div>
            <p className="text-3xl font-bold mt-3">
              {reports.filter((report) => report.status !== 'Closed').length}
            </p>
          </div>

          <div className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-center">
              <p className="text-gray-500 text-sm">Pickup Approvals Needed</p>
              <Clock className="text-purple-700" />
            </div>
            <p className="text-3xl font-bold mt-3">
              {pendingPickupReports.length}
            </p>
          </div>

          <div className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-center">
              <p className="text-gray-500 text-sm">Pending Return Requests</p>
              <RotateCcw className="text-purple-700" />
            </div>
            <p className="text-3xl font-bold mt-3">{pendingReturnCount}</p>
          </div>
        </section>

        <section className="bg-white border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold">My Assigned Assets</h2>
              <p className="text-sm text-gray-500">
                Assets currently assigned to you
              </p>
            </div>

            <button
              onClick={() => loadStaffData()}
              className="p-2 rounded-lg hover:bg-purple-50 text-purple-700"
              title="Refresh"
            >
              <RefreshCw size={19} />
            </button>
          </div>

          {assets.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">
              You currently have no assigned assets.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b text-gray-500">
                    <th className="py-3 pr-4">Asset Tag</th>
                    <th className="py-3 pr-4">Asset Name</th>
                    <th className="py-3 pr-4">Condition</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Assigned Date</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {assets.map((assignment) => {
                    const request = getReturnRequest(assignment.id);

                    const canRequestReturn =
                      assignment.assets?.status === 'Assigned' &&
                      (!request || request.status !== 'Pending');

                    return (
                      <tr
                        key={assignment.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium">
                          {assignment.assets?.asset_tag || 'N/A'}
                        </td>

                        <td className="py-4 pr-4">
                          {assignment.assets?.name || 'Unknown asset'}
                        </td>

                        <td className="py-4 pr-4">
                          {assignment.assets?.condition || 'N/A'}
                        </td>

                        <td className="py-4 pr-4">
                          {assignment.assets?.status || 'N/A'}
                        </td>

                        <td className="py-4 pr-4">
                          {formatDate(assignment.assigned_at)}
                        </td>

                        <td className="py-4">
                          {request?.status === 'Pending' ? (
                            <span className="inline-block px-3 py-2 rounded-lg bg-yellow-100 text-yellow-700 text-xs">
                              Return Pending
                            </span>
                          ) : canRequestReturn ? (
                            <button
                              onClick={() => {
                                setReturnAssignment(assignment);
                                setReturnReason('');
                                setError('');
                                setMessage('');
                              }}
                              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white px-3 py-2 rounded-lg text-xs"
                            >
                              <RotateCcw size={15} />
                              Request Return
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Not available
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {returnAssignment && (
          <section className="bg-white border border-purple-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Request Asset Return</h2>
                <p className="text-sm text-gray-500">
                  {returnAssignment.assets?.asset_tag} -{' '}
                  {returnAssignment.assets?.name}
                </p>
              </div>

              <button
                onClick={() => setReturnAssignment(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitReturnRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason for returning this asset
                </label>

                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why you are returning this asset..."
                  className="w-full border rounded-lg p-3 outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-5 py-3 rounded-lg"
                >
                  {returnSubmitting
                    ? 'Submitting...'
                    : 'Submit Return Request'}
                </button>

                <button
                  type="button"
                  onClick={() => setReturnAssignment(null)}
                  className="border border-gray-300 hover:bg-gray-50 px-5 py-3 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-lg font-bold mb-5">
            My Asset Return Requests
          </h2>

          {returnRequests.length === 0 ? (
            <p className="text-gray-500 py-5 text-center">
              You have not submitted any asset return requests.
            </p>
          ) : (
            <div className="space-y-3">
              {returnRequests.map((request) => {
                const assignment = assets.find(
                  (item) => item.id === request.assignment_id
                );

                return (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {assignment?.assets?.name || 'Asset return request'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Reason: {request.reason}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Requested: {formatDate(request.requested_at)}
                      </p>
                      {request.received_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Received: {formatDate(request.received_at)}
                        </p>
                      )}
                    </div>

                    <span
                      className={`px-3 py-2 rounded-full text-xs w-fit ${statusClass(request.status)}`}
                    >
                      {request.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList className="text-purple-700" />
            <div>
              <h2 className="text-lg font-bold">Report an Asset Problem</h2>
              <p className="text-sm text-gray-500">
                Report a fault with an asset assigned to you
              </p>
            </div>
          </div>

          <form onSubmit={reportIssue} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Asset
              </label>

              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full border rounded-lg p-3 outline-none focus:border-purple-600"
                required
              >
                <option value="">Choose an assigned asset</option>
                {assets.map((assignment) => (
                  <option
                    key={assignment.asset_id}
                    value={assignment.asset_id}
                  >
                    {assignment.assets?.asset_tag} -{' '}
                    {assignment.assets?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Describe the Problem
              </label>

              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={4}
                placeholder="Describe the fault or maintenance issue..."
                className="w-full border rounded-lg p-3 outline-none focus:border-purple-600"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-5 py-3 rounded-lg"
            >
              {submitting ? 'Submitting...' : 'Submit Maintenance Report'}
            </button>
          </form>
        </section>

        <section className="bg-white border rounded-xl p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold">
              Technician Pickup Requests
            </h2>
            <p className="text-sm text-gray-500">
              Approve collection requests for assets currently assigned to you
            </p>
          </div>

          {pendingPickupReports.length === 0 ? (
            <p className="text-gray-500 py-5 text-center">
              There are no pickup requests awaiting your approval.
            </p>
          ) : (
            <div className="space-y-4">
              {pendingPickupReports.map((report) => (
                <div
                  key={report.id}
                  className="border border-purple-200 rounded-lg p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">
                        {report.assets?.name || 'Unknown asset'}
                      </h3>

                      <p className="text-sm text-gray-500">
                        Asset Tag: {report.assets?.asset_tag || 'N/A'}
                      </p>

                      <p className="text-sm mt-2">
                        <strong>Reported problem:</strong>{' '}
                        {report.issue_description}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        Pickup requested:{' '}
                        {formatDate(report.pickup_requested_at)}
                      </p>

                      <span
                        className={`inline-block mt-3 px-3 py-1 rounded-full text-xs ${statusClass(report.pickup_status)}`}
                      >
                        {report.pickup_status}
                      </span>
                    </div>

                    <button
                      onClick={() => approvePickup(report.id)}
                      disabled={processingId === report.id}
                      className="flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-4 py-3 rounded-lg"
                    >
                      <Check size={18} />
                      {processingId === report.id
                        ? 'Approving...'
                        : 'Approve Pickup'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* MAINTENANCE REPORTS */}
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-lg font-bold mb-5">Maintenance Reports</h2>

          {reports.length === 0 ? (
            <p className="text-gray-500 py-5 text-center">
              You have not submitted any maintenance reports.
            </p>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="border rounded-lg p-5">
                  <div className="flex flex-col md:flex-row md:justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {report.assets?.name || 'Unknown asset'}
                      </h3>

                      <p className="text-sm text-gray-500">
                        Asset Tag: {report.assets?.asset_tag || 'N/A'}
                      </p>

                      <p className="text-sm mt-2">
                        {report.issue_description}
                      </p>

                      <p className="text-xs text-gray-500 mt-2">
                        Reported: {formatDate(report.reported_at)}
                      </p>

                      {/* TECHNICIAN NAME */}
                      <p className="text-sm text-purple-700 mt-2">
                        <strong>Technician:</strong>{' '}
                        {report.technician?.full_name || 'Not assigned yet'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 items-start md:items-end">
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${statusClass(report.status)}`}
                      >
                        Maintenance: {report.status}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-xs ${statusClass(report.pickup_status)}`}
                      >
                        Pickup: {report.pickup_status || 'Not Requested'}
                      </span>
                    </div>
                  </div>

                  {report.action_taken && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium">
                        Technician's Action
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {report.action_taken}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-xs text-gray-500">
                    <p>Picked up: {formatDate(report.picked_up_at)}</p>
                    <p>Repair started: {formatDate(report.repair_started_at)}</p>
                    <p>Repair completed: {formatDate(report.repair_completed_at)}</p>
                    <p>Returned: {formatDate(report.returned_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

