
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Wrench,
  RefreshCw,
  Package,
  CheckCircle,
  Clock,
  Play,
  Truck,
} from 'lucide-react';

import { authService } from '../services/authService';
import { supabase } from '../config/supabase';

function TechnicianDashboard() {
  const navigate = useNavigate();

  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkTechnician();
  }, []);

  const checkTechnician = async () => {
    try {
      const session = await authService.getCurrentSession();

      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const profile = await authService.getProfile(session.user.id);

      if (
        profile?.role?.toLowerCase() !== 'technician' ||
        profile?.verification_status !== 'Verified'
      ) {
        navigate('/login', { replace: true });
        return;
      }

      await fetchMaintenance();
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Unable to verify your account.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenance = async () => {
    setError('');

    const { data, error } = await supabase
      .from('maintenance_records')
      .select(`
        id,
        asset_id,
        issue_description,
        status,
        reported_at,
        action_taken,
        technician_id,
        pickup_status,
        pickup_requested_at,
        pickup_approved_at,
        picked_up_at,
        repair_started_at,
        repair_completed_at,
        returned_at,
        assets (
          name,
          asset_tag,
          status
        )
      `)
      .order('reported_at', { ascending: false });

    if (error) {
      console.error('Maintenance error:', error);
      setError(error.message);
      return;
    }

    setMaintenanceRecords(data || []);
  };

  const runAction = async (recordId, functionName, parameters = {}) => {
    setUpdatingId(recordId);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.rpc(functionName, {
        p_record_id: recordId,
        ...parameters,
      });

      if (error) throw error;

      await fetchMaintenance();

      const messages = {
        request_fcams_pickup: 'Pickup request submitted for approval.',
        pickup_fcams_asset: 'Asset successfully marked as picked up.',
        start_fcams_repair: 'Repair marked as In Progress.',
        complete_fcams_repair: 'Repair completed and asset return recorded.',
      };

      setSuccess(messages[functionName] || 'Maintenance updated successfully.');
    } catch (err) {
      console.error('Maintenance action error:', err);
      setError(err.message || 'Unable to complete this action.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteRepair = (recordId) => {
    const actionTaken = window.prompt(
      'Describe the repair work completed:'
    );

    if (!actionTaken || !actionTaken.trim()) {
      return;
    }

    runAction(recordId, 'complete_fcams_repair', {
      p_action_taken: actionTaken.trim(),
    });
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setError('Unable to log out. Please try again.');
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchMaintenance();
    setLoading(false);
  };

  const getPickupLabel = (status) => {
    const labels = {
      'Not Requested': 'Pickup Not Requested',
      'Awaiting Approval': 'Awaiting Approval',
      Approved: 'Pickup Approved',
      'Picked Up': 'Picked Up',
      Returned: 'Returned',
    };

    return labels[status] || status || 'Pickup Not Requested';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-purple-800">
        Loading technician dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-purple-800">FCAMS</h1>
          <p className="text-sm text-gray-500">
            Faculty of Computing Asset Management System
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-600 hover:text-purple-700"
        >
          <LogOut size={18} />
          Logout
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Technician Dashboard
            </h2>
            <p className="text-gray-500 mt-1">
              Manage asset collection, repairs and returns.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-5">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-lg mb-5">
            {success}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-100 text-purple-700 p-3 rounded-lg">
              <Wrench size={22} />
            </div>

            <div>
              <h3 className="font-semibold text-lg">
                Maintenance Reports
              </h3>
              <p className="text-sm text-gray-500">
                {maintenanceRecords.length} reported issue(s)
              </p>
            </div>
          </div>

          {maintenanceRecords.length === 0 ? (
            <p className="text-gray-500 text-center py-10">
              No maintenance reports are available.
            </p>
          ) : (
            <div className="space-y-5">
              {maintenanceRecords.map((record) => {
                const pickupStatus = record.pickup_status || 'Not Requested';
                const isUpdating = updatingId === record.id;

                return (
                  <div
                    key={record.id}
                    className="border border-gray-200 rounded-xl p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {record.assets?.name || 'Asset'}
                        </h4>

                        <p className="text-sm text-gray-500">
                          Asset Tag: {record.assets?.asset_tag || 'Not available'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-purple-700 bg-purple-50 px-3 py-1 rounded-full h-fit">
                          {record.status || 'Open'}
                        </span>

                        <span className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-full h-fit">
                          {getPickupLabel(pickupStatus)}
                        </span>
                      </div>
                    </div>

                    <div className="my-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Reported Issue
                      </p>
                      <p className="text-gray-600">
                        {record.issue_description || 'No description provided.'}
                      </p>
                    </div>

                    {record.action_taken && (
                      <p className="text-sm text-gray-600 mb-3">
                        <strong>Repair work:</strong> {record.action_taken}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500 mb-5">
                      <p>
                        Reported: {record.reported_at
                          ? new Date(record.reported_at).toLocaleString()
                          : 'Unavailable'}
                      </p>

                      {record.pickup_requested_at && (
                        <p>
                          Pickup requested: {new Date(record.pickup_requested_at).toLocaleString()}
                        </p>
                      )}

                      {record.pickup_approved_at && (
                        <p>
                          Pickup approved: {new Date(record.pickup_approved_at).toLocaleString()}
                        </p>
                      )}

                      {record.repair_started_at && (
                        <p>
                          Repair started: {new Date(record.repair_started_at).toLocaleString()}
                        </p>
                      )}

                      {record.returned_at && (
                        <p>
                          Returned: {new Date(record.returned_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {pickupStatus === 'Not Requested' &&
                        record.status === 'Open' && (
                          <button
                            onClick={() =>
                              runAction(record.id, 'request_fcams_pickup')
                            }
                            disabled={isUpdating}
                            className="flex items-center gap-2 bg-purple-700 text-white px-4 py-2 rounded-lg hover:bg-purple-800 disabled:opacity-50"
                          >
                            <Truck size={16} />
                            Request Pickup
                          </button>
                        )}

                      {pickupStatus === 'Awaiting Approval' && (
                        <span className="flex items-center gap-2 text-orange-700 bg-orange-50 px-4 py-2 rounded-lg text-sm">
                          <Clock size={16} />
                          Waiting for Staff/Admin approval
                        </span>
                      )}

                      {pickupStatus === 'Approved' && (
                        <button
                          onClick={() =>
                            runAction(record.id, 'pickup_fcams_asset')
                          }
                          disabled={isUpdating}
                          className="flex items-center gap-2 bg-purple-700 text-white px-4 py-2 rounded-lg hover:bg-purple-800 disabled:opacity-50"
                        >
                          <Package size={16} />
                          Mark as Picked Up
                        </button>
                      )}

                      {pickupStatus === 'Picked Up' &&
                        record.status === 'Open' && (
                          <button
                            onClick={() =>
                              runAction(record.id, 'start_fcams_repair')
                            }
                            disabled={isUpdating}
                            className="flex items-center gap-2 bg-purple-700 text-white px-4 py-2 rounded-lg hover:bg-purple-800 disabled:opacity-50"
                          >
                            <Play size={16} />
                            Start Maintenance
                          </button>
                        )}

                      {pickupStatus === 'Picked Up' &&
                        record.status === 'In Progress' && (
                          <button
                            onClick={() => handleCompleteRepair(record.id)}
                            disabled={isUpdating}
                            className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
                          >
                            <CheckCircle size={16} />
                            Complete Repair & Return
                          </button>
                        )}

                      {pickupStatus === 'Returned' && (
                        <span className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg text-sm">
                          <CheckCircle size={16} />
                          Repair completed and return recorded
                        </span>
                      )}

                      {isUpdating && (
                        <span className="text-sm text-purple-700 py-2">
                          Processing...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default TechnicianDashboard;

