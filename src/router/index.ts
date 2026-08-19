import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
    { path: '/library', name: 'library', component: () => import('@/views/Library.vue') },
    { path: '/board', name: 'board', component: () => import('@/views/ProgressBoard.vue') },
    { path: '/timeline', name: 'timeline', component: () => import('@/views/Timeline.vue') },
    { path: '/filaments', name: 'filaments', component: () => import('@/views/Filaments.vue') },
    { path: '/videos', name: 'videos', component: () => import('@/views/Videos.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue') },
  ],
})

export default router
