
import { supabase } from '../config/supabase';

export const assetService = {
  // Fetch all assets with category and location details
  async getAllAssets() {
    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        categories (name),
        locations (name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Fetch a single asset by ID
  async getAssetById(assetId) {
    if (!assetId) throw new Error('Asset ID is required.');

    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        categories (name),
        locations (name)
      `)
      .eq('id', assetId)
      .single();

    if (error) throw error;
    return data;
  },

  // Register a new asset
  async createAsset(assetDetails) {
    if (!assetDetails || typeof assetDetails !== 'object') {
      throw new Error('Please provide valid asset details.');
    }

    const { data, error } = await supabase
      .from('assets')
      .insert([assetDetails])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update an existing asset
  async updateAsset(assetId, updates) {
    if (!assetId) throw new Error('Asset ID is required.');

    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('Please provide details to update.');
    }

    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', assetId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete an asset
  async deleteAsset(assetId) {
    if (!assetId) throw new Error('Asset ID is required.');

    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId);

    if (error) throw error;
    return true;
  },

  // Fetch asset categories
  async getCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Fetch asset locations
  async getLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Search assets by name or asset tag
  async searchAssets(searchTerm) {
    const term = String(searchTerm || '').trim();

    if (!term) {
      return this.getAllAssets();
    }

    const safeTerm = term.replace(/[,%()]/g, '');

    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        categories (name),
        locations (name)
      `)
      .or(`name.ilike.%${safeTerm}%,asset_tag.ilike.%${safeTerm}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Filter assets by status
  async getAssetsByStatus(status) {
    if (!status) throw new Error('Asset status is required.');

    const { data, error } = await supabase
      .from('assets')
      .select(`
        *,
        categories (name),
        locations (name)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
