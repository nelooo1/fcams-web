
import { supabase } from '../config/supabase';

export const transactionService = {
  // Get verified staff members
  async getStaffMembers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, verification_status')
      .eq('role', 'Staff')
      .eq('verification_status', 'Verified')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Assign one available asset to a staff member
  async assignAsset(assetId, staffId, assignedBy, notes = null) {
    if (!assetId || !staffId || !assignedBy) {
      throw new Error(
        'Asset, staff member and administrator are required.'
      );
    }

    const { data, error } = await supabase.rpc(
      'assign_fcams_asset',
      {
        p_asset_id: assetId,
        p_staff_id: staffId,
        p_notes: notes,
      }
    );

    if (error) throw error;

    return data;
  },

  // Assign multiple available assets to one staff member
  async assignMultipleAssets(
    assetIds,
    staffId,
    assignedBy,
    notes = null
  ) {
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      throw new Error('Select at least one asset.');
    }

    if (!staffId || !assignedBy) {
      throw new Error(
        'Staff member and administrator are required.'
      );
    }

    const { data, error } = await supabase.rpc(
      'assign_multiple_fcams_assets',
      {
        p_asset_ids: assetIds,
        p_staff_id: staffId,
        p_notes: notes,
      }
    );

    if (error) throw error;

    return data;
  },

  // Get active assignments belonging to one staff member
  async getStaffAssignments(staffId) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id,
        asset_id,
        staff_id,
        assigned_by,
        assigned_at,
        is_active,
        notes,
        assets (
          id,
          name,
          asset_tag,
          status,
          location_id,
          categories (name),
          locations (name)
        )
      `)
      .eq('staff_id', staffId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get all asset assignments
  async getAllAssignments() {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        id,
        asset_id,
        staff_id,
        assigned_by,
        assigned_at,
        is_active,
        notes,
        assets (
          name,
          asset_tag
        ),
        profiles:profiles!assignments_staff_id_fkey (
          full_name
        ),
        administrator:profiles!assignments_assigned_by_fkey (
          full_name
        )
      `)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Dispose of an asset and record the disposal
  async disposeAsset(assetId, disposedBy, reason) {
    if (!assetId || !disposedBy || !reason?.trim()) {
      throw new Error(
        'Asset, administrator and disposal reason are required.'
      );
    }

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id, status')
      .eq('id', assetId)
      .single();

    if (assetError) throw assetError;

    if (asset.status === 'Disposed') {
      throw new Error('This asset has already been disposed of.');
    }

    const { data, error } = await supabase
      .from('disposal_history')
      .insert({
        asset_id: assetId,
        disposed_by: disposedBy,
        reason: reason.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    const { error: updateError } = await supabase
      .from('assets')
      .update({ status: 'Disposed' })
      .eq('id', assetId);

    if (updateError) {
      throw new Error(
        `Disposal was recorded, but asset status could not be updated: ${updateError.message}`
      );
    }

    return data;
  },

  // Get asset disposal history
  async getDisposalHistory() {
    const { data, error } = await supabase
      .from('disposal_history')
      .select(`
        *,
        assets (name, asset_tag),
        profiles:profiles!disposal_history_disposed_by_fkey (
          full_name
        )
      `)
      .order('disposed_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
