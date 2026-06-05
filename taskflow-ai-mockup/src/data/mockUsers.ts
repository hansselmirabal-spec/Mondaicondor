import type { MockUser } from '@/types'

export const mockUsers: MockUser[] = [
  { id: 'user-ta', name: 'Tomás Acosta',      initials: 'TA', color: '#e91e8c', email: 'tacosta@condor.com.py' },
  { id: 'user-mz', name: 'María Zárate',      initials: 'MZ', color: '#4c9be8', email: 'mzarate@condor.com.py' },
  { id: 'user-ml', name: 'Marcos López',      initials: 'ML', color: '#6c5ce7', email: 'mlopez@condor.com.py' },
  { id: 'user-jc', name: 'Julia Contreras',   initials: 'JC', color: '#00b894', email: 'jcontreras@condor.com.py' },
  { id: 'user-rp', name: 'Roberto Paredes',   initials: 'RP', color: '#fd79a8', email: 'rparedes@condor.com.py' },
  { id: 'user-sv', name: 'Sofía Vallejos',    initials: 'SV', color: '#fdcb6e', email: 'svallejos@condor.com.py' },
]

export function getUserById(id: string): MockUser | undefined {
  return mockUsers.find(u => u.id === id)
}
