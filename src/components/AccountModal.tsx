import React, { useEffect, useState } from 'react';
import { X, User, Lock, Shield, Trash2, Plus, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

interface AccountUser {
  id: string;
  username: string;
  role: 'admin' | 'standard';
  createdAt: number;
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string; role: 'admin' | 'standard' };
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [users, setUsers] = useState<AccountUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'standard'>('standard');
  const [userMsg, setUserMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const loadUsers = () => {
    setIsLoadingUsers(true);
    fetch('/api/auth/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUsers(data.users);
      })
      .finally(() => setIsLoadingUsers(false));
  };

  useEffect(() => {
    if (isOpen && currentUser.role === 'admin') loadUsers();
    if (!isOpen) {
      // Reset transient form state each time the modal is reopened.
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg(null);
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('standard');
      setUserMsg(null);
    }
  }, [isOpen, currentUser.role]);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPasswordMsg({ type: 'error', text: data.error || 'Failed to change password' });
        return;
      }
      setPasswordMsg({ type: 'success', text: 'Password changed' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPasswordMsg({ type: 'error', text: 'Could not reach the server' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    setIsAddingUser(true);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newUserPassword, role: newUserRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUserMsg({ type: 'error', text: data.error || 'Failed to add user' });
        return;
      }
      setNewUsername('');
      setNewUserPassword('');
      setNewUserRole('standard');
      setUserMsg({ type: 'success', text: `Added ${data.user.username}` });
      loadUsers();
    } catch {
      setUserMsg({ type: 'error', text: 'Could not reach the server' });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setUserMsg(null);
    try {
      const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUserMsg({ type: 'error', text: data.error || 'Failed to remove user' });
        return;
      }
      loadUsers();
    } catch {
      setUserMsg({ type: 'error', text: 'Could not reach the server' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-slate-300" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-mono font-bold">
                Signed in as {currentUser.username}
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white">Account</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* Change my password */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Change My Password
            </h4>
            <form onSubmit={handleChangePassword} className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
              {passwordMsg && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${
                    passwordMsg.type === 'error'
                      ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {passwordMsg.type === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>{passwordMsg.text}</span>
                </div>
              )}
              <input
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {isChangingPassword ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Admin-only: manage users */}
          {currentUser.role === 'admin' && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> User Accounts
              </h4>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 mb-3">
                {isLoadingUsers ? (
                  <div className="text-slate-500 text-center py-2">Loading...</div>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white font-bold truncate">{u.username}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                            u.role === 'admin' ? 'bg-amber-950/50 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                        {u.username === currentUser.username && (
                          <span className="text-slate-600 text-[10px] shrink-0">(you)</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors shrink-0"
                        title="Remove account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {userMsg && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold mb-3 ${
                    userMsg.type === 'error'
                      ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {userMsg.type === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>{userMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleAddUser} className="space-y-2 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Username"
                    autoComplete="off"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'standard')}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="standard">Standard</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <input
                  type="password"
                  placeholder="Password (min 8 characters)"
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isAddingUser || !newUsername || !newUserPassword}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-700 border border-slate-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingUser ? 'Adding...' : 'Add Account'}
                </button>
              </form>
              <p className="text-slate-600 text-[10px] mt-2 leading-relaxed">
                Standard accounts have full use of the app but can't change Frigate/MQTT/BirdNET/PiAware/Weather
                settings or manage other accounts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
