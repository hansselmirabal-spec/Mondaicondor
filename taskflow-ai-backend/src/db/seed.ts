import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://hansselmirabal@localhost:5432/taskflow'

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })

async function main() {
  console.log('Limpiando base de datos...')
  await prisma.activity.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.taskAssignee.deleteMany()
  await prisma.task.deleteMany()
  await prisma.group.deleteMany()
  await prisma.boardSettings.deleteMany()
  await prisma.board.deleteMany()
  await prisma.workspaceSettings.deleteMany()
  await prisma.workspaceMember.deleteMany()
  await prisma.workspace.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.userPreference.deleteMany()
  await prisma.user.deleteMany()

  console.log('Creando usuarios...')
  const passwordHash = await bcrypt.hash('password123', 12)

  const [ta, mz, ml, jc, rp, sv] = await Promise.all([
    prisma.user.create({ data: { email: 'tacosta@condor.com.py',    name: 'Tomás Acosta',    initials: 'TA', color: '#e91e8c', passwordHash } }),
    prisma.user.create({ data: { email: 'mzarate@condor.com.py',   name: 'María Zárate',    initials: 'MZ', color: '#4c9be8', passwordHash } }),
    prisma.user.create({ data: { email: 'mlopez@condor.com.py',    name: 'Marcos López',    initials: 'ML', color: '#6c5ce7', passwordHash } }),
    prisma.user.create({ data: { email: 'jcontreras@condor.com.py',name: 'Julia Contreras', initials: 'JC', color: '#00b894', passwordHash } }),
    prisma.user.create({ data: { email: 'rparedes@condor.com.py',  name: 'Roberto Paredes', initials: 'RP', color: '#fd79a8', passwordHash } }),
    prisma.user.create({ data: { email: 'svallejos@condor.com.py', name: 'Sofía Vallejos',  initials: 'SV', color: '#fdcb6e', passwordHash } }),
  ])

  const userMap = { ta, mz, ml, jc, rp, sv }

  console.log('Creando workspace...')
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Digital',
      slug: 'digital',
      color: '#e91e8c',
      members: {
        create: [
          { userId: ta.id, role: 'ADMIN' },
          { userId: mz.id, role: 'MEMBER' },
          { userId: ml.id, role: 'MEMBER' },
          { userId: jc.id, role: 'MEMBER' },
          { userId: rp.id, role: 'MEMBER' },
          { userId: sv.id, role: 'MEMBER' },
        ],
      },
      settings: { create: { timezone: 'America/Asuncion', language: 'es', updatedAt: new Date() } },
    },
  })

  console.log('Creando board...')
  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      name: 'Pendientes - Digital',
      description: 'Tablero principal de tareas pendientes del equipo digital',
      settings: { create: { updatedAt: new Date() } },
    },
  })

  console.log('Creando grupos...')
  const groups = await Promise.all([
    prisma.group.create({ data: { boardId: board.id, name: 'Always On',  color: '#00c2cd', order: 0 } }),
    prisma.group.create({ data: { boardId: board.id, name: 'Telefonía',  color: '#8b5cf6', order: 1 } }),
    prisma.group.create({ data: { boardId: board.id, name: 'Publicidad', color: '#f59e0b', order: 2 } }),
    prisma.group.create({ data: { boardId: board.id, name: 'Desarrollo', color: '#3b82f6', order: 3 } }),
    prisma.group.create({ data: { boardId: board.id, name: 'Bloqueados', color: '#ef4444', order: 4 } }),
  ])

  const [grpAlwaysOn, grpTelefonia, grpPublicidad, grpDesarrollo, grpBloqueados] = groups

  type TaskSeed = {
    groupId: string
    title: string
    description: string
    status: 'Nuevo' | 'Asignado' | 'EnProgreso' | 'EnRevision' | 'Bloqueado' | 'Completado' | 'AlwaysOn'
    priority: 'Baja' | 'Media' | 'Alta' | 'Critica' | 'AlwaysOn'
    deadline: Date | null
    assignees: Array<typeof ta>
    createdAt: Date
  }

  const tasks: TaskSeed[] = [
    // Always On
    { groupId: grpAlwaysOn.id, title: 'Mystery Shopper por Q', description: 'Evaluación periódica de la experiencia de cliente mediante mystery shopping en todas las UENs del grupo.', status: 'AlwaysOn', priority: 'AlwaysOn', deadline: null, assignees: [userMap.ta], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'Reporte de Redes Sociales', description: 'Informe semanal de métricas de redes sociales: alcance, engagement, crecimiento de seguidores y conversiones.', status: 'AlwaysOn', priority: 'AlwaysOn', deadline: new Date('2025-10-08'), assignees: [userMap.ta, userMap.mz], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'Cumpleaños de colaboradores', description: 'Gestión y comunicación de cumpleaños de colaboradores del grupo.', status: 'AlwaysOn', priority: 'AlwaysOn', deadline: null, assignees: [userMap.ta], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'GV de Tiempos de Respuesta y CSI', description: 'Gestión y seguimiento de los tiempos de respuesta al cliente y Customer Satisfaction Index por concesionaria.', status: 'AlwaysOn', priority: 'AlwaysOn', deadline: null, assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'GV de Ventas Influencer Grupo Cóndor', description: 'Gestión y coordinación de campañas con influencers para impulso de ventas en todas las marcas del grupo.', status: 'AlwaysOn', priority: 'AlwaysOn', deadline: null, assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'Condor Innovation Challenge', description: 'Programa de innovación interna para colaboradores. Recolección de ideas, evaluación y prototipado.', status: 'AlwaysOn', priority: 'AlwaysOn', deadline: null, assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'Cómo vamos a actuar de granjeros en la cartera?', description: 'Estrategia de fidelización y cultivo de la cartera activa de clientes.', status: 'AlwaysOn', priority: 'Alta', deadline: new Date('2025-10-03'), assignees: [userMap.jc, userMap.ta], createdAt: new Date('2025-09-10') },
    { groupId: grpAlwaysOn.id, title: 'Viernes de FIESTA', description: 'Actividad de cierre semanal para el equipo. Reconocimientos, celebraciones y team building cada viernes.', status: 'AlwaysOn', priority: 'Alta', deadline: null, assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'GV de Habilitadores de Venta', description: 'Gestión de habilitadores de venta: test drives, tráfico showroom, visitas comerciales y seguimiento.', status: 'AlwaysOn', priority: 'Alta', deadline: new Date('2025-09-24'), assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'GV Campañas Digitales de WhatsApp', description: 'Gestión de campañas de WhatsApp Business para cada UEN. Segmentación, contenido y métricas.', status: 'AlwaysOn', priority: 'Alta', deadline: null, assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    { groupId: grpAlwaysOn.id, title: 'GV Comentarios "wow"', description: 'Recolección y gestión de comentarios positivos de clientes. Publicación en redes y reconocimiento al equipo.', status: 'AlwaysOn', priority: 'Alta', deadline: null, assignees: [userMap.jc], createdAt: new Date('2025-08-01') },
    // Telefonía
    { groupId: grpTelefonia.id, title: 'Consultoría', description: 'Consultoría externa para optimización del proceso de atención telefónica y protocolos de respuesta.', status: 'Asignado', priority: 'Alta', deadline: new Date('2025-09-19'), assignees: [userMap.ta, userMap.ml], createdAt: new Date('2025-09-01') },
    { groupId: grpTelefonia.id, title: 'Flujograma nuevo', description: 'Diseño del nuevo flujograma de atención telefónica con las mejoras identificadas en la consultoría.', status: 'Asignado', priority: 'Alta', deadline: new Date('2025-09-24'), assignees: [userMap.ml], createdAt: new Date('2025-09-05') },
    { groupId: grpTelefonia.id, title: 'Reportería quincenal', description: 'Generación del reporte quincenal de métricas de telefonía: volumen de llamadas, tiempos y resolución.', status: 'Asignado', priority: 'Baja', deadline: null, assignees: [userMap.ml, userMap.ta], createdAt: new Date('2025-09-01') },
    { groupId: grpTelefonia.id, title: 'Checklist de cambios a realizar por UEN', description: 'Lista de verificación de cambios operativos a implementar en cada UEN según el nuevo protocolo telefónico.', status: 'Asignado', priority: 'Baja', deadline: null, assignees: [userMap.ml, userMap.ta], createdAt: new Date('2025-09-10') },
    { groupId: grpTelefonia.id, title: 'Pruebas para control final', description: 'Pruebas de validación final del nuevo sistema telefónico antes del lanzamiento en producción.', status: 'Asignado', priority: 'Baja', deadline: null, assignees: [userMap.ta, userMap.ml], createdAt: new Date('2025-09-15') },
    // Publicidad
    { groupId: grpPublicidad.id, title: 'Brief campaña Q4', description: 'Elaboración del brief creativo para las campañas publicitarias del cuarto trimestre.', status: 'EnProgreso', priority: 'Alta', deadline: new Date('2025-10-15'), assignees: [userMap.mz, userMap.sv], createdAt: new Date('2025-09-20') },
    { groupId: grpPublicidad.id, title: 'Diseño piezas digitales', description: 'Producción de piezas gráficas para redes sociales, Google Ads y WhatsApp según el brief Q4.', status: 'EnProgreso', priority: 'Media', deadline: new Date('2025-10-20'), assignees: [userMap.sv], createdAt: new Date('2025-09-25') },
    { groupId: grpPublicidad.id, title: 'Plan de medios octubre', description: 'Planificación y distribución del presupuesto de medios para el mes de octubre por canal y UEN.', status: 'EnRevision', priority: 'Alta', deadline: new Date('2025-10-01'), assignees: [userMap.mz], createdAt: new Date('2025-09-18') },
    // Desarrollo
    { groupId: grpDesarrollo.id, title: 'Landing page nueva UEN', description: 'Desarrollo de nueva landing page optimizada para conversión de la UEN Motos.', status: 'EnProgreso', priority: 'Alta', deadline: new Date('2025-10-30'), assignees: [userMap.ml, userMap.rp], createdAt: new Date('2025-09-28') },
    { groupId: grpDesarrollo.id, title: 'Integración CRM', description: 'Integración del CRM con los formularios de contacto del sitio web para captura automática de leads.', status: 'Nuevo', priority: 'Media', deadline: null, assignees: [userMap.rp], createdAt: new Date('2025-10-01') },
    // Bloqueados
    { groupId: grpBloqueados.id, title: 'Automatización de reportes', description: 'Sistema de generación automática de reportes semanales. Bloqueado por falta de acceso a API del ERP.', status: 'Bloqueado', priority: 'Critica', deadline: new Date('2025-09-30'), assignees: [userMap.ml], createdAt: new Date('2025-09-01') },
    { groupId: grpBloqueados.id, title: 'Acceso a analytics UEN Motos', description: 'Solicitud de acceso a Google Analytics y Meta Business de UEN Motos pendiente de aprobación IT.', status: 'Bloqueado', priority: 'Alta', deadline: new Date('2025-09-25'), assignees: [userMap.ta], createdAt: new Date('2025-09-10') },
  ]

  console.log('Creando tareas...')
  for (const t of tasks) {
    const task = await prisma.task.create({
      data: {
        groupId: t.groupId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        deadline: t.deadline,
        createdAt: t.createdAt,
        assignees: { create: t.assignees.map((u) => ({ userId: u.id })) },
      },
    })

    await prisma.activity.create({
      data: { taskId: task.id, userId: t.assignees[0].id, action: `Creó la tarea "${t.title}"`, createdAt: t.createdAt },
    })
  }

  console.log('\n✅ Seed completado:')
  console.log(`   Usuarios:    6`)
  console.log(`   Workspace:   1 (Digital)`)
  console.log(`   Board:       1 (Pendientes - Digital)`)
  console.log(`   Grupos:      5`)
  console.log(`   Tareas:      ${tasks.length}`)
  console.log('\nCredenciales: cualquier email del seed + password: password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
