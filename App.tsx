// FIX: Switched to namespace import for React to resolve JSX intrinsic element errors, which is necessary for this project's TypeScript configuration.
import * as React from 'react';
// FIX: Refactor Firebase calls to v8 compat syntax.
import firebase from 'firebase/compat/app';
import { auth, db } from './firebaseConfig';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Schedule from './components/Schedule';
import { Connections } from './components/Connections';
import SuccessPage from './components/Success'; // Import the new SuccessPage component
import HomePage from './components/HomePage';
import { Page, Post } from './types';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import CookiesPage from './components/CookiesPage';
import Persona from './components/Persona';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
// FIX: Refactor Firebase calls to v8 compat syntax.
// No longer need modular imports from firestore
// import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';

const App: React.FC = () => {
    // If the path is /success, render the success page. This is for the OAuth popup.
    if (window.location.pathname === '/success') {
        return <SuccessPage />;
    }
    if (window.location.pathname === '/terms') {
        return <TermsPage />;
    }
    if (window.location.pathname === '/privacy') {
        return <PrivacyPage />;
    }
    if (window.location.pathname === '/cookies') {
        return <CookiesPage />;
    }
    if (window.location.pathname === '/about') {
        return <AboutPage />;
    }
    if (window.location.pathname === '/contact') {
        return <ContactPage />;
    }


    // FIX: Refactor Firebase calls to v8 compat syntax.
    const [user, setUser] = React.useState<firebase.User | null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [currentPage, setCurrentPage] = React.useState<Page>(Page.HOME);
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
    const scheduledPostsRef = React.useRef<Post[]>([]);
    
    const toggleSidebar = React.useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    const toggleSidebarCollapse = React.useCallback(() => {
        setIsSidebarCollapsed(prev => !prev);
    }, []);


    React.useEffect(() => {
        // FIX: Refactor Firebase calls to v8 compat syntax.
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                setCurrentPage(Page.SCHEDULE);
            } else {
                setCurrentPage(Page.HOME);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Automatic webhook publishing engine - REWRITTEN FOR STABILITY
    React.useEffect(() => {
        if (!user) return;

        // 1. Set up a listener that keeps our ref updated with the latest scheduled posts.
        // FIX: Refactor Firebase calls to v8 compat syntax.
        const postsCol = db.collection('posts');
        const q = postsCol.where("userId", "==", user.uid).where("status", "==", "scheduled");
        
        // FIX: Refactor Firebase calls to v8 compat syntax.
        const unsubscribeFromPosts = q.onSnapshot((snapshot) => {
            const posts: Post[] = [];
            snapshot.forEach(doc => {
                 const data = doc.data();
                 // Ensure data from Firestore matches the Post type by converting Timestamp to ISO string
                 posts.push({
                     id: doc.id,
                     ...data,
                     // FIX: Refactor Firebase calls to v8 compat syntax.
                     scheduledAt: (data.scheduledAt as firebase.firestore.Timestamp).toDate().toISOString()
                 } as Post);
            });
            scheduledPostsRef.current = posts;
            console.log(`Updated scheduled posts list. Found: ${posts.length}`);
        });

        // 2. Set up a SINGLE, stable interval that runs once per minute.
        const intervalId = setInterval(async () => {
            const now = new Date();
            // Always use the most current list of posts from the ref.
            const duePosts = scheduledPostsRef.current.filter(p => {
                // p.scheduledAt is now an ISO string, convert it to a Date object for comparison
                const scheduledDate = new Date(p.scheduledAt);
                return scheduledDate <= now;
            });

            if (duePosts.length === 0) {
                return; // Nothing to do this minute.
            }

            console.log(`Found ${duePosts.length} due post(s) to publish.`);
            
            for (const post of duePosts) {
                // Double-check status in ref before processing to avoid race conditions
                const currentPostState = scheduledPostsRef.current.find(p => p.id === post.id);
                if (!currentPostState || currentPostState.status !== 'scheduled') {
                    continue; // Post was already processed or its state changed
                }

                try {
                    console.log(`Publishing post: ${post.id}`);
                    
                    const formData = new FormData();
                    formData.append('caption', post.caption);
                    formData.append('platforms', JSON.stringify(post.platforms));
                    formData.append('tags', JSON.stringify(post.tags));
                    // post.scheduledAt is already an ISO string
                    formData.append('scheduledAt', post.scheduledAt);
                    
                    // Fetch all media files as blobs and get their original names
                    const mediaUploads = await Promise.all(post.mediaUrls.map(async (url) => {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch media from ${url}: ${response.statusText}`);
                        }
                        const blob = await response.blob();
                        const fileName = url.split('/').pop()?.split('?')[0].split('%2F').pop() || 'media';
                        return { blob, fileName };
                    }));

                    mediaUploads.forEach(({ blob, fileName }, index) => {
                         formData.append(`media[${index}]`, blob, fileName);
                    });

                    const response = await fetch('https://n8n.sahaai.online/webhook/sheet-status', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(`Webhook failed with status ${response.status}`);
                    }

                    // FIX: Refactor Firebase calls to v8 compat syntax.
                    const postRef = db.collection('posts').doc(post.id);
                    await postRef.update({ status: 'published' });
                    console.log(`Successfully published post: ${post.id}`);

                } catch (error) {
                    console.error(`Failed to publish post ${post.id}:`, error);
                    // FIX: Refactor Firebase calls to v8 compat syntax.
                    const postRef = db.collection('posts').doc(post.id);
                    await postRef.update({ status: 'failed' });
                }
            }
        }, 60000); // Check every minute

        // 3. Cleanup function to clear the listener and the single interval.
        return () => {
            unsubscribeFromPosts();
            clearInterval(intervalId);
        };
    }, [user]);


    const handleLogout = React.useCallback(() => {
        // FIX: Refactor Firebase calls to v8 compat syntax.
        auth.signOut().catch((error) => console.error("Logout failed", error));
    }, []);



    const navigate = React.useCallback((page: Page) => {
        setCurrentPage(page);
        setIsSidebarOpen(false); // Close sidebar on navigation
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }
    
    if (!user) {
        switch (currentPage) {
            case Page.HOME:
                return <HomePage navigateToLogin={() => navigate(Page.LOGIN)} navigateToRegister={() => navigate(Page.REGISTER)} />;
            case Page.LOGIN:
                return <Login navigateToRegister={() => navigate(Page.REGISTER)} />;
            case Page.REGISTER:
                return <Register navigateToLogin={() => navigate(Page.LOGIN)} />;
            default:
                return <HomePage navigateToLogin={() => navigate(Page.LOGIN)} navigateToRegister={() => navigate(Page.REGISTER)} />;
        }
    }

    const renderPage = () => {
        switch (currentPage) {
            case Page.DASHBOARD:
                return <Dashboard />;
            case Page.SCHEDULE:
                return <Schedule />;
            case Page.SETTINGS:
                return <Settings user={user} />;
            case Page.CONNECTIONS:
                return <Connections />;
            case Page.PERSONA:
                return <Persona user={user} />;
            default:
                return <Schedule />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
            <Sidebar 
                navigate={navigate} 
                currentPage={currentPage} 
                isOpen={isSidebarOpen} 
                toggle={toggleSidebar}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={toggleSidebarCollapse}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header user={user} onLogout={handleLogout} toggleSidebar={toggleSidebar} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    {renderPage()}
                </main>
            </div>
        </div>
    );
};

export default App;