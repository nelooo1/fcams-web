
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  Wrench,
  Search,
  Plus,
  LogOut,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  ClipboardList,
  Trash2,
  History,
  RotateCcw,
} from 'lucide-react';

import { supabase } from '../config/supabase';
import { authService } from '../services/authService';
import { assetService } from '../services/assetService';
import { transactionService } from '../services/transactionService';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [databaseNotice, setDatabaseNotice] = useState('');

  const [activeSection, setActiveSection] = useState('assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newAsset, setNewAsset] = useState({
    name: '',
    asset_tag: '',
    category_id: '',
  });

  const [assignmentForm, setAssignmentForm] = useState({
    staff_id: '',
  });

  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  const [disposalForm, setDisposalForm] = useState({
    asset_id: '',
    reason: '',
  });

  const [reportForm, setReportForm] = useState({
    asset_id: '',
    issue_description: '',
  });

  const statuses = [
    'Available',
    'Assigned',
    'Under Maintenance',
    'Damaged',
    'Missing',
    'Disposed',
  ];

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadPendingUsers() {
    try {
      const users = await authService.getPendingUsers();
      setPendingUsers(users || []);
    } catch (err) {
      console.error('Pending users error:', err);
      setPendingUsers([]);
    }
  }

  async function loadAdminData() {
    setLoading(true);
    setError('');
    setDatabaseNotice('');

    try {
      const session = await authService.getCurrentSession();

      if (!session?.user) {
        navigate('/login');
        return;
      }

      const profile = await authService.getProfile(session.user.id);

      if (
        !profile ||
        String(profile.role).toLowerCase() !== 'administrator' ||
        profile.verification_status !== 'Verified'
      ) {
        navigate('/login');
        return;
      }

      setAdmin(profile);

      await loadPendingUsers();

      const [assetData, categoryData] = await Promise.all([
        assetService.getAllAssets(),
        assetService.getCategories(),
      ]);

      setAssets(assetData || []);
      setCategories(categoryData || []);

      const results = await Promise.allSettled([
        transactionService.getStaffMembers(),
        transactionService.getAllAssignments(),
        transactionService.getDisposalHistory(),
      ]);

      const notices = [];

      if (results[0].status === 'fulfilled') {
        setStaffMembers(results[0].value || []);
      } else {
        setStaffMembers([]);
        notices.push('Staff records are not available yet.');
      }

      if (results[1].status === 'fulfilled') {
        setAssignments(results[1].value || []);
      } else {
        setAssignments([]);
        notices.push('Assignment records are not available yet.');
      }

      if (results[2].status === 'fulfilled') {
        setDisposals(results[2].value || []);
      } else {
        setDisposals([]);
        notices.push('Disposal history is not available yet.');
      }

      // Load maintenance records, including Technician names.
      const { data: maintenanceData, error: maintenanceError } =
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
              name,
              asset_tag
            )
          `)
          .order('reported_at', { ascending: false });

      if (maintenanceError) {
        console.error('Maintenance records error:', maintenanceError);
        setMaintenanceRecords([]);
        notices.push('Maintenance records are not available yet.');
      } else {
        setMaintenanceRecords(maintenanceData || []);
      }

      // Load Staff asset return requests.
      const { data: returnData, error: returnError } = await supabase
        .from('asset_return_requests')
        .select(`
          id,
          assignment_id,
          asset_id,
          staff_id,
          reason,
          status,
          requested_at,
          received_by,
          received_at,
          assets (
            name,
            asset_tag
          ),
          profiles:profiles!asset_return_requests_staff_id_fkey (
            full_name
          )
        `)
        .order('requested_at', { ascending: false });

      if (returnError) {
        console.error('Asset return requests error:', returnError);
        setReturnRequests([]);
        notices.push('Asset return requests are not available yet.');
      } else {
        setReturnRequests(returnData || []);
      }

      if (notices.length) {
        setDatabaseNotice(notices.join(' '));
      }
    } catch (err) {
      console.error('Admin dashboard error:', err);
      setError(err.message || 'Unable to load dashboard information.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveUser(user) {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await authService.approveUser(user.id);

      setSuccess(
        `${user.full_name || 'User'} has been approved successfully.`
      );

      await loadPendingUsers();
    } catch (err) {
      console.error('Account approval error:', err);
      setError(err.message || 'Unable to approve account.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectUser(user) {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await authService.rejectUser(user.id);

      setSuccess(`${user.full_name || 'User'} has been rejected.`);
      await loadPendingUsers();
    } catch (err) {
      console.error('Account rejection error:', err);
      setError(err.message || 'Unable to reject account.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAsset(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (
      !newAsset.name.trim() ||
      !newAsset.asset_tag.trim() ||
      !newAsset.category_id
    ) {
      setError('Please complete all asset details.');
      return;
    }

    setSaving(true);

    try {
      await assetService.createAsset({
        name: newAsset.name.trim(),
        asset_tag: newAsset.asset_tag.trim(),
        category_id: newAsset.category_id,
        status: 'Available',
      });

      setNewAsset({
        name: '',
        asset_tag: '',
        category_id: '',
      });

      setShowAddForm(false);
      setSuccess('Asset registered successfully.');

      await loadAdminData();
    } catch (err) {
      console.error('Asset registration error:', err);
      setError(err.message || 'Unable to register asset.');
    } finally {
      setSaving(false);
    }
  }

  function toggleAssetSelection(assetId) {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    );
  }

  function selectAllAvailableAssets() {
    setSelectedAssetIds(availableAssets.map((asset) => asset.id));
  }

  function clearAssetSelection() {
    setSelectedAssetIds([]);
  }

  async function handleAssignAsset(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (selectedAssetIds.length === 0) {
      setError('Select at least one asset.');
      return;
    }

    if (!assignmentForm.staff_id) {
      setError('Select a staff member.');
      return;
    }

    if (!admin?.id) {
      setError('Administrator information is unavailable.');
      return;
    }

    setSaving(true);

    try {
      await transactionService.assignMultipleAssets(
        selectedAssetIds,
        assignmentForm.staff_id,
        admin.id
      );

      const assignedCount = selectedAssetIds.length;

      setSelectedAssetIds([]);
      setAssignmentForm({ staff_id: '' });

      setSuccess(
        `${assignedCount} asset${assignedCount === 1 ? '' : 's'} assigned successfully.`
      );

      await loadAdminData();
    } catch (err) {
      console.error('Multiple asset assignment error:', err);
      setError(err.message || 'Unable to assign selected assets.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReportIssue(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!reportForm.asset_id || !reportForm.issue_description.trim()) {
      setError('Please select an asset and describe the problem.');
      return;
    }

    if (!admin?.id) {
      setError('Administrator information is unavailable.');
      return;
    }

    setSaving(true);

    try {
      const { error: reportError } = await supabase
        .from('maintenance_records')
        .insert({
          asset_id: reportForm.asset_id,
          reported_by: admin.id,
          issue_description: reportForm.issue_description.trim(),
          status: 'Open',
        });

      if (reportError) throw reportError;

      setReportForm({
        asset_id: '',
        issue_description: '',
      });

      setSuccess('Maintenance issue reported successfully.');

      await loadAdminData();
    } catch (err) {
      console.error('Administrator maintenance report error:', err);
      setError(err.message || 'Unable to submit maintenance report.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprovePickup(record) {
    const confirmed = window.confirm(
      `Approve the Technician to collect ${record.assets?.name || 'this asset'}?`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const { error: approvalError } = await supabase.rpc(
        'approve_fcams_pickup',
        {
          p_record_id: record.id,
        }
      );

      if (approvalError) throw approvalError;

      setSuccess('Technician pickup request approved successfully.');

      await loadAdminData();
    } catch (err) {
      console.error('Pickup approval error:', err);
      setError(err.message || 'Unable to approve pickup request.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAssetReturn(request) {
    const confirmed = window.confirm(
      `Confirm that you have physically received ${request.assets?.name || 'this asset'} from ${request.profiles?.full_name || 'the Staff member'}?`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const { error: confirmError } = await supabase.rpc(
        'confirm_fcams_asset_return',
        {
          p_request_id: request.id,
        }
      );

      if (confirmError) throw confirmError;

      setSuccess(
        `${request.assets?.name || 'Asset'} return confirmed successfully.`
      );

      await loadAdminData();
    } catch (err) {
      console.error('Asset return confirmation error:', err);
      setError(err.message || 'Unable to confirm asset return.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisposeAsset(event) {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!disposalForm.asset_id || !disposalForm.reason.trim()) {
      setError('Select an asset and provide a disposal reason.');
      return;
    }

    if (!admin?.id) {
      setError('Administrator information is unavailable.');
      return;
    }

    setSaving(true);

    try {
      await transactionService.disposeAsset(
        disposalForm.asset_id,
        admin.id,
        disposalForm.reason.trim()
      );

      setDisposalForm({
        asset_id: '',
        reason: '',
      });

      setSuccess('Asset disposal recorded successfully.');
      await loadAdminData();
    } catch (err) {
      console.error('Asset disposal error:', err);
      setError(err.message || 'Unable to record asset disposal.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(assetId, newStatus) {
    if (newStatus === 'Disposed') {
      setError(
        'Use the Asset Disposal section to record a disposal properly.'
      );
      return;
    }

    setError('');
    setSuccess('');

    try {
      await assetService.updateAsset(assetId, {
        status: newStatus,
      });

      setAssets((currentAssets) =>
        currentAssets.map((asset) =>
          asset.id === assetId
            ? { ...asset, status: newStatus }
            : asset
        )
      );

      setSuccess('Asset status updated successfully.');
    } catch (err) {
      console.error('Status update error:', err);
      setError(err.message || 'Unable to update asset status.');
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Unable to log out.');
    }
  }

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        String(asset.name || '').toLowerCase().includes(search) ||
        String(asset.asset_tag || '').toLowerCase().includes(search) ||
        String(asset.categories?.name || '')
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === 'All' || asset.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [assets, searchTerm, statusFilter]);

  const availableAssets = assets.filter(
    (asset) => asset.status === 'Available'
  );

  const activeAssignmentAssetIds = new Set(
    assignments
      .filter((assignment) => assignment.is_active)
      .map((assignment) => assignment.asset_id)
  );

  const adminPickupRequests = maintenanceRecords.filter(
    (record) =>
      record.pickup_status === 'Awaiting Approval' &&
      !activeAssignmentAssetIds.has(record.asset_id)
  );

  const pendingReturnRequests = returnRequests.filter(
    (request) => request.status === 'Pending'
  );

  const statistics = [
    {
      title: 'Total Assets',
      value: assets.length,
      icon: Package,
    },
    {
      title: 'Available',
      value: availableAssets.length,
      icon: CheckCircle,
    },
    {
      title: 'Assigned',
      value: assets.filter((asset) => asset.status === 'Assigned').length,
      icon: Users,
    },
    {
      title: 'Under Maintenance',
      value: assets.filter(
        (asset) => asset.status === 'Under Maintenance'
      ).length,
      icon: Wrench,
    },
  ];

  function getStatusStyle(status) {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-700';
      case 'Assigned':
        return 'bg-purple-100 text-purple-700';
      case 'Under Maintenance':
        return 'bg-yellow-100 text-yellow-700';
      case 'Damaged':
        return 'bg-red-100 text-red-700';
      case 'Missing':
        return 'bg-orange-100 text-orange-700';
      case 'Disposed':
        return 'bg-gray-200 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  function changeSection(section) {
    setActiveSection(section);
    setError('');
    setSuccess('');
  }

  function formatDate(date) {
    return date ? new Date(date).toLocaleString() : '—';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw
            className="mx-auto mb-3 animate-spin text-purple-700"
            size={32}
          />
          <p className="text-gray-600">
            Loading administrator dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* SIDEBAR */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-gray-200 bg-white p-6 md:block">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-purple-700">FCAMS</h1>
          <p className="mt-1 text-xs text-gray-500">
            Faculty of Computing
          </p>
        </div>

        <nav className="space-y-2">
          <button
            onClick={() => changeSection('assets')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'assets'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard size={19} />
            Dashboard
          </button>

          <button
            onClick={() => changeSection('users')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'users'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={19} />
            User Approvals
            {pendingUsers.length > 0 && (
              <span className="ml-auto rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => changeSection('assignments')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'assignments'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardList size={19} />
            Asset Assignment
          </button>

          <button
            onClick={() => changeSection('report')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'report'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AlertCircle size={19} />
            Report Asset Issue
          </button>

          <button
            onClick={() => changeSection('maintenance')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'maintenance'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wrench size={19} />
            Maintenance & Pickup
            {adminPickupRequests.length > 0 && (
              <span className="ml-auto rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white">
                {adminPickupRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => changeSection('returns')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'returns'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <RotateCcw size={19} />
            Asset Returns
            {pendingReturnRequests.length > 0 && (
              <span className="ml-auto rounded-full bg-purple-700 px-2 py-0.5 text-xs text-white">
                {pendingReturnRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => changeSection('disposal')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'disposal'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Trash2 size={19} />
            Asset Disposal
          </button>

          <button
            onClick={() => changeSection('history')}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${
              activeSection === 'history'
                ? 'bg-purple-100 font-medium text-purple-800'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <History size={19} />
            Disposal History
          </button>
        </nav>

        <button
          onClick={handleLogout}
          className="absolute bottom-8 left-6 flex items-center gap-3 rounded-lg px-4 py-3 text-red-600 hover:bg-red-50"
        >
          <LogOut size={19} />
          Log out
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="md:ml-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-5 md:px-8">
          <div>
            <h2 className="text-xl font-bold md:text-2xl">
              Administrator Dashboard
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor faculty assets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">
                {admin?.full_name || 'Administrator'}
              </p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-100 md:hidden"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </header>

        <div className="p-5 md:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <p>{error}</p>
              <button onClick={() => setError('')} className="ml-auto">
                <X size={17} />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              <CheckCircle size={19} className="mt-0.5 shrink-0" />
              <p>{success}</p>
              <button onClick={() => setSuccess('')} className="ml-auto">
                <X size={17} />
              </button>
            </div>
          )}

          {databaseNotice && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <p>{databaseNotice}</p>
            </div>
          )}

          {/* USER APPROVALS */}
          {activeSection === 'users' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">
                    Pending Account Approvals
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Review and approve new account registrations.
                  </p>
                </div>

                <button
                  onClick={loadPendingUsers}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p>No accounts are waiting for approval.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-4 py-3">Full Name</th>
                        <th className="px-4 py-3">ID Type</th>
                        <th className="px-4 py-3">Requested Role</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pendingUsers.map((user) => (
                        <tr key={user.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 font-medium">
                            {user.full_name || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {user.id_type || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {user.requested_role || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveUser(user)}
                                disabled={saving}
                                className="rounded-lg bg-purple-700 px-3 py-2 text-white hover:bg-purple-800 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectUser(user)}
                                disabled={saving}
                                className="rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ASSET DASHBOARD */}
          {activeSection === 'assets' && (
            <>
              <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statistics.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.title}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-purple-400"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          {stat.title}
                        </p>
                        <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
                          <Icon size={20} />
                        </div>
                      </div>
                      <p className="mt-4 text-3xl font-bold">
                        {stat.value}
                      </p>
                    </div>
                  );
                })}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Asset Inventory</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Register, search and manage faculty assets.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-800"
                  >
                    {showAddForm ? <X size={18} /> : <Plus size={18} />}
                    {showAddForm ? 'Close Form' : 'Register Asset'}
                  </button>
                </div>

                {showAddForm && (
                  <form
                    onSubmit={handleAddAsset}
                    className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-5"
                  >
                    <h4 className="mb-4 font-semibold">
                      Register New Asset
                    </h4>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Asset Name
                        </label>
                        <input
                          type="text"
                          value={newAsset.name}
                          onChange={(event) =>
                            setNewAsset({
                              ...newAsset,
                              name: event.target.value,
                            })
                          }
                          placeholder="e.g. HP Laptop"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Asset Tag
                        </label>
                        <input
                          type="text"
                          value={newAsset.asset_tag}
                          onChange={(event) =>
                            setNewAsset({
                              ...newAsset,
                              asset_tag: event.target.value,
                            })
                          }
                          placeholder="e.g. FC-CMP-001"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Category
                        </label>
                        <select
                          value={newAsset.category_id}
                          onChange={(event) =>
                            setNewAsset({
                              ...newAsset,
                              category_id: event.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                          required
                        >
                          <option value="">Select category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="mt-5 rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save Asset'}
                    </button>
                  </form>
                )}

                <div className="mb-5 flex flex-col gap-3 md:flex-row">
                  <div className="relative flex-1">
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by asset name, tag or category..."
                      className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2.5"
                  >
                    <option value="All">All statuses</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={loadAdminData}
                    className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-100"
                  >
                    <RefreshCw size={17} />
                    Refresh
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-600">
                        <th className="px-4 py-3">Asset Tag</th>
                        <th className="px-4 py-3">Asset Name</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredAssets.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-10 text-center text-gray-500"
                          >
                            No assets found.
                          </td>
                        </tr>
                      ) : (
                        filteredAssets.map((asset) => (
                          <tr
                            key={asset.id}
                            className="border-b border-gray-100 hover:bg-purple-50/40"
                          >
                            <td className="px-4 py-4 font-medium">
                              {asset.asset_tag || 'Not assigned'}
                            </td>
                            <td className="px-4 py-4">{asset.name}</td>
                            <td className="px-4 py-4">
                              {asset.categories?.name || 'Uncategorised'}
                            </td>
                            <td className="px-4 py-4">
                              {asset.locations?.name ||
                                asset.location ||
                                'Not assigned'}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-2">
                                <span
                                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(asset.status)}`}
                                >
                                  {asset.status}
                                </span>
                                <select
                                  value={asset.status || 'Available'}
                                  onChange={(event) =>
                                    handleStatusChange(
                                      asset.id,
                                      event.target.value
                                    )
                                  }
                                  disabled={asset.status === 'Disposed'}
                                  className="max-w-[160px] rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                                  aria-label={`Change status for ${asset.name}`}
                                >
                                  {statuses
                                    .filter((status) => status !== 'Disposed')
                                    .map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-gray-500">
                  Showing {filteredAssets.length} of {assets.length} assets.
                </p>
              </section>
            </>
          )}

          {/* MULTIPLE ASSET ASSIGNMENT */}
          {activeSection === 'assignments' && (
            <section className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-2 text-lg font-bold">
                  Assign Multiple Assets to Staff
                </h3>

                <p className="mb-5 text-sm text-gray-500">
                  Select one or more available assets, then choose the Staff
                  member receiving them.
                </p>

                <form onSubmit={handleAssignAsset} className="space-y-5">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="text-sm font-semibold">
                        Select Assets ({selectedAssetIds.length} selected)
                      </label>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllAvailableAssets}
                          disabled={availableAssets.length === 0}
                          className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                        >
                          Select All
                        </button>

                        <button
                          type="button"
                          onClick={clearAssetSelection}
                          disabled={selectedAssetIds.length === 0}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs hover:bg-gray-100 disabled:opacity-50"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {availableAssets.length === 0 ? (
                      <p className="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500">
                        No available assets to assign.
                      </p>
                    ) : (
                      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                        {availableAssets.map((asset) => (
                          <label
                            key={asset.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                              selectedAssetIds.includes(asset.id)
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => toggleAssetSelection(asset.id)}
                              className="h-4 w-4 accent-purple-700"
                            />

                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {asset.name}
                              </span>
                              <span className="block text-xs text-gray-500">
                                {asset.asset_tag}
                                {asset.categories?.name
                                  ? ` • ${asset.categories.name}`
                                  : ''}
                              </span>
                            </span>

                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                              Available
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Select Staff Member
                    </label>

                    <select
                      value={assignmentForm.staff_id}
                      onChange={(event) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          staff_id: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                      required
                    >
                      <option value="">Choose staff member</option>
                      {staffMembers.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      selectedAssetIds.length === 0 ||
                      !assignmentForm.staff_id
                    }
                    className="rounded-lg bg-purple-700 px-6 py-2.5 text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? 'Assigning...'
                      : `Assign ${selectedAssetIds.length || ''} Selected Asset${selectedAssetIds.length === 1 ? '' : 's'}`}
                  </button>
                </form>

                {staffMembers.length === 0 && (
                  <p className="mt-4 text-sm text-yellow-700">
                    No verified Staff accounts are available.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-bold">
                  Assignment Records
                </h3>

                {assignments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No assignment records are available.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3">Asset</th>
                          <th className="px-4 py-3">Asset Tag</th>
                          <th className="px-4 py-3">Staff Member</th>
                          <th className="px-4 py-3">Date Assigned</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {assignments.map((assignment) => (
                          <tr
                            key={assignment.id}
                            className="border-b border-gray-100"
                          >
                            <td className="px-4 py-3">
                              {assignment.assets?.name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3">
                              {assignment.assets?.asset_tag || '—'}
                            </td>
                            <td className="px-4 py-3">
                              {assignment.profiles?.full_name || 'Unknown'}
                            </td>
                            <td className="px-4 py-3">
                              {assignment.assigned_at
                                ? new Date(
                                    assignment.assigned_at
                                  ).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {assignment.is_active ? 'Active' : 'Inactive'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ADMINISTRATOR REPORT ISSUE */}
          {activeSection === 'report' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 p-3 text-purple-700">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      Report Asset Issue
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Report a problem with any faculty asset.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleReportIssue} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Select Asset
                  </label>

                  <select
                    value={reportForm.asset_id}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        asset_id: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3"
                    required
                  >
                    <option value="">Choose an asset</option>

                    {assets
                      .filter((asset) => asset.status !== 'Disposed')
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.asset_tag || 'No asset tag'}) — {asset.status}
                        </option>
                      ))}
                  </select>

                  {assets.filter((asset) => asset.status !== 'Disposed')
                    .length === 0 && (
                    <p className="mt-2 text-sm text-yellow-700">
                      There are no available assets to report.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Describe the Problem
                  </label>

                  <textarea
                    rows="5"
                    value={reportForm.issue_description}
                    onChange={(event) =>
                      setReportForm({
                        ...reportForm,
                        issue_description: event.target.value,
                      })
                    }
                    placeholder="Describe the fault or problem with the selected asset..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    required
                  />
                </div>

                <div className="rounded-lg bg-purple-50 p-4 text-sm text-purple-800">
                  <p className="font-medium">What happens next?</p>
                  <p className="mt-1">
                    The report will be added to Maintenance Progress. A
                    Technician can review the report and request permission
                    to collect the asset for repair.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !reportForm.asset_id ||
                    !reportForm.issue_description.trim()
                  }
                  className="flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-6 py-3 font-medium text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <AlertCircle size={18} />
                  {saving ? 'Submitting Report...' : 'Submit Maintenance Report'}
                </button>
              </form>
            </section>
          )}

          {/* MAINTENANCE AND PICKUP */}
          {activeSection === 'maintenance' && (
            <section className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-5">
                  <h3 className="text-lg font-bold">
                    Pending Technician Pickup Approvals
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Approve collection requests for assets without an active Staff assignment.
                  </p>
                </div>

                {adminPickupRequests.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No pickup requests are awaiting Administrator approval.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {adminPickupRequests.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-lg border border-purple-200 p-5"
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                          <div>
                            <h4 className="font-semibold">
                              {record.assets?.name || 'Unknown asset'}
                            </h4>

                            <p className="mt-1 text-sm text-gray-500">
                              Asset Tag: {record.assets?.asset_tag || 'N/A'}
                            </p>

                            <p className="mt-3 text-sm">
                              <strong>Reported problem:</strong>{' '}
                              {record.issue_description}
                            </p>

                            <p className="mt-2 text-xs text-gray-500">
                              Pickup requested: {formatDate(record.pickup_requested_at)}
                            </p>

                            <span className="mt-3 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs text-yellow-800">
                              Awaiting Approval
                            </span>
                          </div>

                          <button
                            onClick={() => handleApprovePickup(record)}
                            disabled={saving}
                            className="rounded-lg bg-purple-700 px-5 py-3 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                          >
                            {saving ? 'Processing...' : 'Approve Pickup'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      Maintenance Progress
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Monitor reported problems, repairs and asset returns.
                    </p>
                  </div>

                  <button
                    onClick={loadAdminData}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>

                {maintenanceRecords.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No maintenance records are available.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {maintenanceRecords.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-lg border border-gray-200 p-5"
                      >
                        <div className="flex flex-col justify-between gap-3 md:flex-row">
                          <div>
                            <h4 className="font-semibold">
                              {record.assets?.name || 'Unknown asset'}
                            </h4>

                            <p className="text-sm text-gray-500">
                              Asset Tag: {record.assets?.asset_tag || 'N/A'}
                            </p>

                            <p className="mt-3 text-sm">
                              {record.issue_description}
                            </p>

                            <p className="mt-2 text-xs text-gray-500">
                              Reported: {formatDate(record.reported_at)}
                            </p>

                            {/* NEW: TECHNICIAN NAME */}
                            <p className="mt-2 text-sm text-purple-700">
                              <strong>Technician:</strong>{' '}
                              {record.technician?.full_name || 'Not assigned yet'}
                            </p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-800">
                              Repair: {record.status}
                            </span>

                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                              Pickup: {record.pickup_status || 'Not Requested'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-sm md:grid-cols-2">
                          <p>
                            <strong>Pickup requested:</strong>{' '}
                            {formatDate(record.pickup_requested_at)}
                          </p>

                          <p>
                            <strong>Pickup approved:</strong>{' '}
                            {formatDate(record.pickup_approved_at)}
                          </p>

                          <p>
                            <strong>Asset collected:</strong>{' '}
                            {formatDate(record.picked_up_at)}
                          </p>

                          <p>
                            <strong>Repair started:</strong>{' '}
                            {formatDate(record.repair_started_at)}
                          </p>

                          <p>
                            <strong>Repair completed:</strong>{' '}
                            {formatDate(record.repair_completed_at)}
                          </p>

                          <p>
                            <strong>Asset returned:</strong>{' '}
                            {formatDate(record.returned_at)}
                          </p>
                        </div>

                        {record.action_taken && (
                          <div className="mt-4 rounded-lg bg-gray-50 p-3">
                            <p className="text-sm font-semibold">
                              Technician's Repair Notes
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {record.action_taken}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ASSET RETURNS */}
          {activeSection === 'returns' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">
                    Staff Asset Return Requests
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Confirm receipt after Staff members physically return their assigned assets.
                  </p>
                </div>

                <button
                  onClick={loadAdminData}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {returnRequests.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <RotateCcw className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p>No asset return requests are available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {returnRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-lg border border-gray-200 p-5"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <h4 className="font-semibold">
                            {request.assets?.name || 'Unknown asset'}
                          </h4>

                          <p className="mt-1 text-sm text-gray-500">
                            Asset Tag: {request.assets?.asset_tag || 'N/A'}
                          </p>

                          <p className="mt-2 text-sm">
                            <strong>Staff Member:</strong>{' '}
                            {request.profiles?.full_name || 'Unknown'}
                          </p>

                          <p className="mt-2 text-sm">
                            <strong>Reason for return:</strong>{' '}
                            {request.reason}
                          </p>

                          <p className="mt-2 text-xs text-gray-500">
                            Requested: {formatDate(request.requested_at)}
                          </p>

                          {request.received_at && (
                            <p className="mt-1 text-xs text-gray-500">
                              Received: {formatDate(request.received_at)}
                            </p>
                          )}

                          <span
                            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs ${
                              request.status === 'Received'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>

                        {request.status === 'Pending' && (
                          <button
                            onClick={() => handleConfirmAssetReturn(request)}
                            disabled={saving}
                            className="rounded-lg bg-purple-700 px-5 py-3 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
                          >
                            {saving ? 'Processing...' : 'Confirm Return'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ASSET DISPOSAL */}
          {activeSection === 'disposal' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-2 text-lg font-bold">
                Record Asset Disposal
              </h3>

              <p className="mb-5 text-sm text-gray-500">
                Record an asset that is no longer suitable for faculty use.
              </p>

              <form onSubmit={handleDisposeAsset} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Select Asset
                  </label>

                  <select
                    value={disposalForm.asset_id}
                    onChange={(event) =>
                      setDisposalForm({
                        ...disposalForm,
                        asset_id: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                    required
                  >
                    <option value="">Choose asset to dispose</option>
                    {assets
                      .filter((asset) => asset.status !== 'Disposed')
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.asset_tag}) — {asset.status}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Reason for Disposal
                  </label>

                  <textarea
                    rows="4"
                    value={disposalForm.reason}
                    onChange={(event) =>
                      setDisposalForm({
                        ...disposalForm,
                        reason: event.target.value,
                      })
                    }
                    placeholder="Explain why the asset is being disposed of..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-red-700 px-6 py-2.5 text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {saving ? 'Recording...' : 'Record Disposal'}
                </button>
              </form>
            </section>
          )}

          {/* DISPOSAL HISTORY */}
          {activeSection === 'history' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-bold">
                Asset Disposal History
              </h3>

              {disposals.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <History className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p>No disposal records are available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3">Asset</th>
                        <th className="px-4 py-3">Asset Tag</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Disposed By</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {disposals.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-gray-100"
                        >
                          <td className="px-4 py-3">
                            {record.assets?.name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3">
                            {record.assets?.asset_tag || '—'}
                          </td>
                          <td className="px-4 py-3">{record.reason}</td>
                          <td className="px-4 py-3">
                            {record.profiles?.full_name || 'Unknown'}
                          </td>
                          <td className="px-4 py-3">
                            {record.disposed_at
                              ? new Date(
                                  record.disposed_at
                                ).toLocaleDateString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
