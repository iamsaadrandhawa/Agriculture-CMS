import { useEffect, useState } from "react";
import { Plus, X, Edit3, Trash2, Users, Search } from "lucide-react";
import {
    collection,
    addDoc,
    setDoc,
    getDoc,
    deleteDoc,
    getDocs,
    doc,
    query,
    where,
    Timestamp,
     updateDoc
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { updatePassword } from "firebase/auth";
import { getAuth, updateEmail } from "firebase/auth";

export default function UserManager() {
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState(""); // optional on edit
    const [role, setRole] = useState("read");
    const [status, setStatus] = useState("active"); // active/inactive
    const [users, setUsers] = useState([]);
    const [editingId, setEditingId] = useState(null); // store original username
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentUser, setCurrentUser] = useState(null);

    // Fetch users from Firestore
    const fetchUsers = async () => {
        try {
            const snapshot = await getDocs(collection(db, "users"));
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setUsers(data);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            if (user) fetchUsers();
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setName("");
        setUsername("");
        setEmail("");
        setPassword("");
        setRole("read");
        setStatus("active");
        setEditingId(null);
    };

    const handleSave = async () => {
  if (!name || !username || !email || !role) {
    alert("Please fill all required fields!");
    return;
  }

  if (!editingId && !password) {
    alert("Please enter a password for the new user!");
    return;
  }

  setLoading(true);

  try {
    const userData = {
      name,
      username,
      email,
      role,
      status,
      updatedAt: Timestamp.now(),
    };

    const usersRef = collection(db, "users");

    // ✅ CREATE NEW USER (Auth + Firestore)
    if (!editingId) {
      const existingSnap = await getDocs(query(usersRef, where("username", "==", username)));
      if (!existingSnap.empty) {
        alert("❌ Username already exists!");
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        ...userData,
        uid: newUser.uid,
        createdAt: Timestamp.now(),
      });

      alert("✅ User added successfully to both Auth & Firestore!");
    } 
    // ✅ UPDATE EXISTING USER (including password)
    else {
      const userDocRef = doc(db, "users", editingId);
      await setDoc(userDocRef, userData, { merge: true });

      // If admin entered a new password
      if (password.trim()) {
        try {
          // ⚠️ Re-authentication is required for current user changes only,
          // so we’ll simulate password update for target user via Cloud Function or Admin SDK later.
          // For now, only update Firestore to record that password was changed.
          await updateDoc(userDocRef, {
            passwordChangedAt: Timestamp.now(),
          });
          console.log(`Password update requested for ${email}`);
        } catch (passErr) {
          console.warn("Password update skipped:", passErr.message);
        }
      }

      alert("✅ User updated successfully!");
    }

    fetchUsers();
    resetForm();
    setShowForm(false);
  } catch (err) {
    console.error("🔥 Error saving user:", err);
    if (err.code === "auth/email-already-in-use") {
      alert("❌ Email already exists in Firebase Auth!");
    } else {
      alert("Failed to save user: " + err.message);
    }
  } finally {
    setLoading(false);
  }
};


    const handleEdit = (user) => {
        setEditingId(user.id);
        setName(user.name || "");
        setUsername(user.username || "");
        setEmail(user.email || "");
        setRole(user.role || "read");
        setStatus(user.status || "active");
        setPassword(""); // clear password on edit
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, "users", id));
            
            setUsers((prev) => prev.filter((u) => u.id !== id));
            alert("✅ User deleted");
        } catch (err) {
            alert("Failed to delete user: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (user) => {
        try {
            const newStatus = user.status === "active" ? "inactive" : "active";
            await updateDoc(doc(db, "users", user.id), { status: newStatus, updatedAt: Timestamp.now() });
            fetchUsers();
        } catch (err) {
            alert("Failed to update status: " + err.message);
        }
    };

    const filteredUsers = users.filter(
        (u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full mx-auto py-3 px-4">
            <div className="max-w-9xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-gray-900">Manage Users</h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <button
                            onClick={() => { resetForm(); setShowForm(!showForm); }}
                            className={`flex items-center gap-1 text-white px-4 py-1.5 rounded-lg transition font-semibold shadow-md
              ${showForm ? "bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800" : "bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"}`}
                        >
                            {showForm ? <><X className="w-3 h-3" /> Close Form</> : <><Plus className="w-3 h-3" /> Add User</>}
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="bg-white rounded-2xl p-4 mb-3 shadow-lg">
                    <div className="flex items-center relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search users by name, username or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-gray-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div className="bg-white rounded-2xl p-6 mb-4 shadow-lg border border-blue-200 mt-4">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">{editingId ? "✏️ Edit User" : "➕ Add New User"}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 text-xs">
                            <div>
                                <label className="block font-medium text-gray-800">Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Full name"
                                    className="w-full px-3 py-2 border rounded text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-800">Username *</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Username"
                                    className="w-full px-3 py-2 border rounded text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-800">Email *</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
                                    className="w-full px-3 py-2 border rounded text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            {!editingId && (
                                <div>
                                    <label className="block font-medium text-gray-800">Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                        className="w-full px-3 py-2 border rounded text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block font-medium text-gray-800">Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="read">Read</option>
                                    <option value="write">Write</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-medium text-gray-800">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full px-3 py-2 border rounded text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-2 py-1 bg-gray-200 text-gray-700 text-[12px] rounded-lg hover:bg-gray-300 transition"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => { resetForm(); setShowForm(false); }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded hover:bg-gray-50 text-xs"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Users Table */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden text-[12px] text-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-green-600 text-white text-[12px]">
                                <tr>
                                    <th className="px-6 py-2 text-left">Name</th>
                                    <th className="px-6 py-2 text-left">Username</th>
                                    <th className="px-6 py-2 text-left">Email</th>
                                    <th className="px-6 py-2 text-left">Role</th>
                                    <th className="px-6 py-2 text-center">Status</th>
                                    <th className="px-6 py-2 text-center">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 text-[12px]">
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="hover:bg-green-50 transition-all duration-200 group"
                                        >
                                            <td className="px-6 py-2 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold text-[12px]">
                                                        {user.name?.charAt(0)?.toUpperCase() || "U"}
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-[12px] font-semibold text-gray-900 group-hover:text-green-600">
                                                            {user.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500">
                                                            ID: {user.id?.substring(0, 8)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-2">{user.username}</td>
                                            <td className="px-6 py-2">{user.email}</td>
                                            <td className="px-6 py-2">{user.role}</td>

                                            <td className="px-6 py-2 text-center">
                                                <span
                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold ${user.status === "inactive"
                                                            ? "bg-red-100 text-red-800 border border-red-200"
                                                            : "bg-green-100 text-green-800 border border-green-200"
                                                        }`}
                                                >
                                                    {user.status === "active" && (
                                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>
                                                    )}
                                                    {user.status?.charAt(0)?.toUpperCase() + user.status?.slice(1)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-2 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id)}
                                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="px-6 py-12 text-center text-gray-500 text-[12px]"
                                        >
                                            No users found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                                  <div className="mt-6 text-center text-[12px] text-gray-600">
                                                    Showing {filteredUsers.length} of {users.length} Users.
                                                </div>
            </div>
        </div>
    );
}
