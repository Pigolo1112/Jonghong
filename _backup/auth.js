/* ================================================
   ระบบจองห้องประชุม — Auth Module
   ================================================ */

import { supabase } from './supabase-config.js';

let currentUser = null;
let currentProfile = null;

// Initialize auth - check session
async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }

    currentUser = session.user;
    
    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    currentProfile = profile;
    return { user: currentUser, profile: currentProfile };
}

// Get current user
function getUser() {
    return currentUser;
}

// Get current profile
function getProfile() {
    return currentProfile;
}

// Check role
function isAdmin() {
    return currentProfile?.role === 'admin';
}

function isStaff() {
    return currentProfile?.role === 'staff';
}

function isStudent() {
    return currentProfile?.role === 'student';
}

function hasRole(...roles) {
    return roles.includes(currentProfile?.role);
}

// Sign out
async function signOut() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// Listen for auth changes
function onAuthChange(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentProfile = null;
            window.location.href = 'login.html';
        }
        if (callback) callback(event, session);
    });
}

// Update profile
async function updateProfile(updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id)
        .select()
        .single();
    
    if (error) throw error;
    currentProfile = data;
    return data;
}

export {
    initAuth,
    getUser,
    getProfile,
    isAdmin,
    isStaff,
    isStudent,
    hasRole,
    signOut,
    onAuthChange,
    updateProfile
};
