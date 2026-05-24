import { useState, useEffect } from 'react';
import api from '../config/api';
import {
  SUPER_ADMIN_PERMISSIONS,
  ROLE_OPTIONS
} from '../utils/superAdminPermissions';
import '../pages/DoctorDashboard.css';

const AdminTeamTab = ({ canManage, onSuccess, onError }) => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
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
      phone: '',
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
      phone: member.phone,
      password: '',
      role: member.role,
      jobTitle: member.jobTitle || '',
      permissions: member.permissions || []
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        jobTitle: form.jobTitle,
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
      onError?.(err.response?.data?.message || 'Failed to save team member');
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
      <div className="staff-tab-header">
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
                      <td className="staff-actions">
                        {!member.isOwner && (
                          <>
                            <button type="button" className="btn-sm" onClick={() => openEdit(member)}>Edit</button>
                            <button type="button" className="btn-sm" onClick={() => toggleActive(member)}>
                              {member.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button type="button" className="btn-sm btn-danger" onClick={() => removeMember(member)}>Remove</button>
                          </>
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
        <div className="modal-overlay staff-modal-overlay" onClick={resetForm} role="presentation">
          <div className="modal-content staff-modal-content" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>{editing ? 'Edit Team Member' : 'Add Team Member'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!!editing} />
              </div>
              {!editing && (
                <>
                  <div className="form-row">
                    <label>Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="form-row">
                    <label>Phone</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                  </div>
                  <div className="form-row">
                    <label>Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                  </div>
                </>
              )}
              <div className="form-row">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Job Title</label>
                <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. Support Lead" />
              </div>
              {form.role === 'custom' && (
                <div className="permissions-grid">
                  <p className="permissions-hint">Select permissions for this member:</p>
                  {Object.entries(groupedPermissions).map(([group, perms]) => (
                    <div key={group} className="permission-group">
                      <h4>{group}</h4>
                      {perms.map((p) => (
                        <label key={p.key} className="permission-check">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
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
