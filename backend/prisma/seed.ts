import "dotenv/config";
import { PrismaClient, Role, ProjectStatus, TaskStatus, TaskPriority } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Demo admin (akan ditimpa saat user pertama login Google jika email sama)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      googleId: "seed-admin",
      email: "admin@example.com",
      name: "Admin Project (seed)",
      role: Role.ADMIN_PROJECT,
    },
  });

  const project = await prisma.project.upsert({
    where: { code: "DEMO-001" },
    update: {},
    create: {
      name: "Demo Infrastruktur Kantor Pusat",
      code: "DEMO-001",
      description: "Proyek contoh untuk pengujian task manager.",
      status: ProjectStatus.ACTIVE,
      ownerId: admin.id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      creatorId: admin.id,
      title: "Audit konfigurasi firewall perimeter",
      description: "Cek rule, log, dan kepatuhan terhadap baseline keamanan.",
      division: Role.NETWORK_SECURITY_ENGINEER,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      creatorId: admin.id,
      title: "Setup VLAN baru di switch core",
      division: Role.NETWORK_ENGINEER,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
    },
  });

  console.log("Seed selesai. Admin demo: admin@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
