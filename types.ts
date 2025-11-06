

export enum Page {
    HOME = 'HOME',
    LOGIN = 'LOGIN',
    REGISTER = 'REGISTER',
    DASHBOARD = 'DASHBOARD',
    SCHEDULE = 'SCHEDULE',
    SETTINGS = 'SETTINGS',
    CONNECTIONS = 'CONNECTIONS',
    PERSONA = 'PERSONA',
    SUCCESS = 'SUCCESS',
}

export enum SocialPlatform {
    TWITTER = 'Twitter',
    LINKEDIN = 'LinkedIn',
    DRIBBBLE = 'Dribbble',
    INSTAGRAM = 'Instagram',
    FACEBOOK = 'Facebook',
    THREADS = 'Threads',
    YOUTUBE = 'YouTube',
    TIKTOK = 'TikTok',
}

export interface Post {
    id: string;
    userId: string;
    caption: string;
    platforms: SocialPlatform[];
    tags: string[];
    mediaUrls: string[];
    scheduledAt: string; // Stored as ISO string in state
    status: 'scheduled' | 'published' | 'failed' | 'draft';
}

export interface Persona {
    id?: string;
    userId: string;
    name: string;
    characteristics: string;
    avoid: string;
}