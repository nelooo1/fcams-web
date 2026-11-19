
import { supabase } from '../config/supabase';

export const authService = {
  // Register a new FCAMS user
  async signUp(email, password, fullName, idType, idNumber, accountType) {
    const validRoles = ['administrator', 'staff', 'technician'];

    const selectedRole = String(accountType || '')
      .toLowerCase()
      .trim();

    if (!validRoles.includes(selectedRole)) {
      throw new Error('Please select a valid account type.');
    }

    if (!email || !password || !fullName || !idType || !idNumber) {
      throw new Error('Please complete all registration fields.');
    }

    const requestedRole =
      selectedRole === 'administrator'
        ? 'Administrator'
        : selectedRole === 'technician'
          ? 'Technician'
          : 'Staff';

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          requested_role: requestedRole,
          id_type: idType,
          id_number: idNumber.trim(),
        },
      },
    });

    if (error) throw error;

    return data;
  },

  // Sign in
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;

    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  },

  // Get current session
  async getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    return data.session;
  },

  // Get current authenticated user
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    return data.user;
  },

  // Get user profile
  async getProfile(userId) {
    if (!userId) {
      throw new Error('User ID is required.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return data;
  },

  // Get pending Administrator and Technician registrations
  async getPendingUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        id_type,
        id_number,
        role,
        requested_role,
        verification_status
      `)
      .eq('verification_status', 'Pending')
      .in('requested_role', ['Administrator', 'Technician'])
      .order('full_name', { ascending: true });

    if (error) throw error;

    return data || [];
  },

  // Approve a registration through the secure database function
  async approveUser(userId) {
    if (!userId) {
      throw new Error('User ID is required.');
    }

    const { data, error } = await supabase.rpc(
      'approve_fcams_user',
      { p_user_id: userId }
    );

    if (error) throw error;

    return data;
  },

  // Reject a registration through the secure database function
  async rejectUser(userId) {
    if (!userId) {
      throw new Error('User ID is required.');
    }

    const { data, error } = await supabase.rpc(
      'reject_fcams_user',
      { p_user_id: userId }
    );

    if (error) throw error;

    return data;
  },
};




