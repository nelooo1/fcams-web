
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  KeyRound,
  User,
  IdCard,
  AlertCircle,
} from 'lucide-react';
import { authService } from '../services/authService';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    accountType: '',
    idNumber: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const idLabels = {
    administrator: 'Administrator ID',
    staff: 'Staff ID',
    technician: 'Technician ID',
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'accountType' ? { idNumber: '' } : {}),
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    const fullName = formData.fullName.trim();
    const email = formData.email.trim();
    const idNumber = formData.idNumber.trim();

    if (!formData.accountType) {
      setError('Please select an account type.');
      return;
    }

    if (!fullName || !email || !idNumber) {
      setError('Please complete all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      await authService.signUp(
        email,
        formData.password,
        fullName,
        idLabels[formData.accountType],
        idNumber,
        formData.accountType
      );

      navigate('/login', {
        replace: true,
        state: {
          message:
            'Registration submitted successfully. Your account is awaiting administrator approval.',
        },
      });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">

        <div className="text-center mb-8">
          <div className="bg-purple-700 p-3 rounded-full inline-block mb-3">
            <UserPlus className="text-white h-8 w-8" />
          </div>

          <h2 className="text-2xl font-bold text-gray-800">
            Create an Account
          </h2>

          <p className="text-sm text-gray-500 mt-2">
            Faculty of Computing Asset Management System
          </p>

          <p className="text-xs text-gray-400 mt-1">
            Register to access the asset management platform
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md flex items-center text-sm">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>

            <select
              name="accountType"
              required
              value={formData.accountType}
              onChange={handleChange}
              className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Select account type</option>
              <option value="administrator">Administrator</option>
              <option value="staff">Staff</option>
              <option value="technician">Technician</option>
            </select>

            {formData.accountType === 'administrator' && (
              <p className="text-xs text-amber-700 mt-2">
                Administrator accounts require approval before administrator access is granted.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>

            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter your full name"
              />
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
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter your email address"
              />
            </div>
          </div>

          {formData.accountType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {idLabels[formData.accountType]}
              </label>

              <div className="relative">
                <IdCard className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

                <input
                  type="text"
                  name="idNumber"
                  required
                  value={formData.idNumber}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  placeholder={`Enter your ${idLabels[formData.accountType]}`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>

            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-5 w-5 text-gray-400" />

              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-purple-700 hover:text-purple-900"
          >
            Sign in here
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Faculty of Computing
        </p>
      </div>
    </div>
  );
}

