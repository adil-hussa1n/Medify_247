import { useState, useEffect } from 'react';
import api from '../config/api';
import {
  SUPER_ADMIN_PERMISSIONS,
  ROLE_OPTIONS
} from '../utils/superAdminPermissions';
import {
  formatPhoneNumber,
  normalizePhoneForApi,
  isValidApiPhone
} from '../utils/phoneFormat';

const AdminTeamTab = ({ canManage, onSuccess, onError }) => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '+88',
    password: '',
    role: 'support',
    jobTitle: '',
    permissions: []
  });

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/team');
      if (response.data.success) {
        setTeam(response.data.data.team || []);
      }
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to load admin team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({
      name: '',
      email: '',
      phone: '+88',
      password: '',
      role: 'support',
      jobTitle: '',
      permissions: []
    });
  };

  const openEdit = (member) => {
    if (member.isOwner) return;
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: formatPhoneNumber(member.phone || '+88'),
      password: '',
      role: member.role,
      jobTitle: member.jobTitle || '',
      permissions: member.permissions || []
    });
    setShowForm(true);
  };

  const getApiErrorMessage = (err, fallback) => {
    const data = err.response?.data;
    if (data?.errors?.length) {
      return data.errors.map((e) => e.msg).join('. ');
    }
    return data?.message || fallback;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const phone = normalizePhoneForApi(form.phone);
      if (!editing && !isValidApiPhone(phone)) {
        onError?.('Enter a valid phone number (e.g. +8801712345678)');
        return;
      }

      if (form.role === 'custom' && form.permissions.length === 0) {
        onError?.('Select at least one permission for a custom role');
        return;
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone,
        role: form.role,
        jobTitle: form.jobTitle.trim(),
        ...(form.role === 'custom' ? { permissions: form.permissions } : {})
      };
      if (!editing) {
        payload.password = form.password;
      }

      const response = editing
        ? await api.put(`/admin/team/${editing._id}`, payload)
        : await api.post('/admin/team', payload);

      if (response.data.success) {
        onSuccess?.(editing ? 'Team member updated' : 'Team member added');
        resetForm();
        fetchTeam();
      }
    } catch (err) {
      onError?.(getApiErrorMessage(err, 'Failed to save team member'));
    }
  };

  const toggleActive = async (member) => {
    if (member.isOwner) return;
    try {
      const response = await api.put(`/admin/team/${member._id}`, {
        isActive: !member.isActive
      });
      if (response.data.success) {
        onSuccess?.(member.isActive ? 'Team member deactivated' : 'Team member activated');
        fetchTeam();
      }
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to update status');
    }
  };

  const removeMember = async (member) => {
    if (member.isOwner) return;
    if (!window.confirm(`Remove ${member.name} from the admin team?`)) return;
    try {
      const response = await api.delete(`/admin/team/${member._id}`);
      if (response.data.success) {
        onSuccess?.('Team member removed');
        fetchTeam();
      }
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to remove team member');
    }
  };

  const togglePermission = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key]
    }));
  };

  const groupedPermissions = SUPER_ADMIN_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {});

  return (
    <div className="staff-tab admin-team-tab">
      <div className="admin-team-header">
        <div>
          <h2>Admin Team & Access Control</h2>
          <p className="staff-tab-desc">
            Add platform admin users and assign roles with specific permissions.
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + Add Team Member
          </button>
        )}
      </div>

      <div className="staff-table-wrap">
        {loading ? (
          <p>Loading team...</p>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Job Title</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {team.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="empty-cell">No team members yet.</td>
                </tr>
              ) : (
                team.map((member) => (
                  <tr key={member._id}>
                    <td>{member.name}{member.isOwner ? ' (Owner)' : ''}</td>
                    <td>{member.email}</td>
                    <td><span className="role-badge">{member.roleLabel || member.role}</span></td>
                    <td>{member.jobTitle || '—'}</td>
                    <td>
                      <span className={`status-badge ${member.isActive ? 'status-approved' : 'status-rejected'}`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="admin-team-actions-cell">
                        {!member.isOwner && (
                          <div className="admin-team-actions">
                            <button type="button" className="admin-team-action-btn edit" onClick={() => openEdit(member)}>Edit</button>
                            <button type="button" className="admin-team-action-btn toggle" onClick={() => toggleActive(member)}>
                              {member.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button type="button" className="admin-team-action-btn delete" onClick={() => removeMember(member)}>Remove</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {showForm && canManage && (
        <div className="admin-team-modal-overlay" onClick={resetForm} role="presentation">
          <div
            className="admin-team-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-team-modal-title"
          >
            <div className="admin-team-modal-header">
              <h2 id="admin-team-modal-title">{editing ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button type="button" className="admin-team-modal-close" onClick={resetForm} aria-label="Close">
                ×
              </button>
            </div>
            <form className="admin-team-form" onSubmit={handleSubmit}>
              <div className="admin-team-modal-body">
                <div className="admin-team-form-group">
                  <label htmlFor="admin-team-name">Name *</label>
                  <input
                    id="admin-team-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    disabled={!!editing}
                  />
                </div>
                {!editing && (
                  <>
                    <div className="admin-team-form-group">
                      <label htmlFor="admin-team-email">Email *</label>
                      <input
                        id="admin-team-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-team-form-group">
                      <label htmlFor="admin-team-phone">Phone *</label>
                      <input
                        id="admin-team-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })}
                        placeholder="+8801712345678"
                        required
                      />
                      <small className="admin-team-field-hint">Use country code, e.g. +8801712345678</small>
                    </div>
                    <div className="admin-team-form-group">
                      <label htmlFor="admin-team-password">Password *</label>
                      <input
                        id="admin-team-password"
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        minLength={8}
                      />
                      <small className="admin-team-field-hint">Minimum 8 characters</small>
                    </div>
                  </>
                )}
                <div className="admin-team-form-group">
                  <label htmlFor="admin-team-role">Role *</label>
                  <select
                    id="admin-team-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-team-form-group">
                  <label htmlFor="admin-team-job-title">Job Title</label>
                  <input
                    id="admin-team-job-title"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="e.g. Support Lead"
                  />
                </div>
                {form.role === 'custom' && (
                  <div className="admin-team-permissions">
                    <p className="admin-team-permissions-hint">Select permissions for this member:</p>
                    {Object.entries(groupedPermissions).map(([group, perms]) => (
                      <div key={group} className="admin-team-permission-group">
                        <h4>{group}</h4>
                        <div className="admin-team-permission-list">
                          {perms.map((p) => (
                            <label key={p.key} className="admin-team-permission-check">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(p.key)}
                                onChange={() => togglePermission(p.key)}
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-team-modal-footer">
                <button type="button" className="admin-team-btn-secondary" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {editing ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeamTab;
