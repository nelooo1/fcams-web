
import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Building2,
  KeyRound,
  Mail,
  AlertCircle,
  UserRound,
  CheckCircle,
} from 'lucide-react';
import { authService } from '../services/authService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const successMessage = location.state?.message;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!accountType) {
      setError('Please select your account type.');
      return;
    }

    setIsLoading(true);

    let signedIn = false;

    try {
      // Sign in with Supabase.
      const data = await authService.signIn(
        email.trim().toLowerCase(),
        password
      );

      signedIn = true;

      // Retrieve the user's profile.
      const profile = await authService.getProfile(data.user.id);

      if (!profile) {
        throw new Error('Your user profile could not be found.');
      }

      const actualRole = String(profile.role || '')
        .toLowerCase()
        .trim();

      const requestedRole = String(
        profile.requested_role || profile.role || ''
      )
        .toLowerCase()
        .trim();

      const verificationStatus = String(
        profile.verification_status || ''
      )
        .toLowerCase()
        .trim();

      const normalizedRole =
        requestedRole === 'admin' ? 'administrator' : requestedRole;

      const selectedRole = accountType.toLowerCase().trim();

      // Confirm that the selected account type matches registration.
      if (normalizedRole !== selectedRole) {
        throw new Error(
          `This account is not registered as ${accountType}. Please select the correct account type.`
        );
      }

      // Staff accounts are automatically verified.
      // Administrators and Technicians must be verified.
      if (
        normalizedRole !== 'staff' &&
        verificationStatus !== 'verified'
      ) {
        throw new Error(
          verificationStatus === 'rejected'
            ? 'Your account registration was not approved. Please contact the system administrator.'
            : 'Your account is awaiting administrator approval.'
        );
      }

      // Direct users to their respective dashboards.
      if (normalizedRole === 'administrator') {
        if (actualRole !== 'administrator') {
          throw new Error(
            'Your Administrator account has not been fully approved yet.'
          );
        }

        navigate('/admin/dashboard', { replace: true });
      } else if (normalizedRole === 'staff') {
        if (actualRole !== 'staff') {
          throw new Error(
            'Your Staff account role could not be confirmed. Please contact the administrator.'
          );
        }

        navigate('/staff/dashboard', { replace: true });
      } else if (normalizedRole === 'technician') {
        if (actualRole !== 'technician') {
          throw new Error(
            'Your Technician account has not been fully approved yet.'
          );
        }

        navigate('/technician/dashboard', { replace: true });
      } else {
        throw new Error(
          'Invalid account type. Please contact the administrator.'
        );
      }
    } catch (err) {
      if (signedIn) {
        try {
          await authService.signOut();
        } catch (signOutError) {
          console.error('Sign-out error:', signOutError);
        }
      }

      setError(
        err.message || 'Failed to sign in. Check your login details.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">

        <div className="text-center mb-8">
          <div className="bg-purple-700 p-3 rounded-full inline-block mb-3">
            <Building2 className="text-white h-8 w-8" />
          </div>

          <h2 className="text-2xl font-bold text-gray-800">
            FCAMS
          </h2>

          <p className="text-sm text-gray-500 mt-2">
            Faculty of Computing Asset Management System
          </p>

          <h3 className="text-lg font-semibold text-gray-800 mt-5">
            Welcome Back
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Sign in to access your account
          </p>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 text-purple-800 rounded-md flex items-center text-sm">
            <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md flex items-center text-sm">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>

            <div className="relative">
              <UserRound className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />

              <select
                required
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select your account type</option>
                <option value="administrator">Administrator</option>
                <option value="staff">Staff</option>
                <option value="technician">Technician</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>

            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter your email address"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>

            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-purple-700 hover:text-purple-900"
          >
            Create an account
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Faculty of Computing
        </p>
      </div>
    </div>
  );
}

