/*eslint-disable no-console*/
import { BookingStatus, PaymentStatus } from './generated/client'
import prisma from '@/lib/prisma'

async function main() {
  console.log('Cleaning existing seed data...')
  // Clear tables in dependency order to prevent FK constraint errors
  await prisma.payment.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.turf.deleteMany()
  await prisma.user.deleteMany()
  await prisma.webhookEvent.deleteMany()

  console.log('Seeding users...')
  const user1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      id: 'usr_01',
      email: 'john@example.com',
      name: 'John Doe'
    }
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      id: 'usr_02',
      email: 'jane@example.com',
      name: 'Jane Smith'
    }
  })

  console.log('Seeding turfs...')
  const turf1 = await prisma.turf.create({
    data: {
      name: 'Downtown Sports Arena',
      location: '123 Main St, Sector 4',
      pricePerHr: 1500,
      openHour: 6,
      closeHour: 23,
      slotMinutes: 60,
      imageUrl: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6'
    }
  })

  const turf2 = await prisma.turf.create({
    data: {
      name: 'Greenfield Football Ground',
      location: '45 Park Avenue',
      pricePerHr: 2000,
      openHour: 7,
      closeHour: 22,
      slotMinutes: 90,
      imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018'
    }
  })

  console.log('Seeding bookings & payments...')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startTime = new Date()
  startTime.setHours(18, 0, 0, 0)

  const endTime = new Date()
  endTime.setHours(19, 0, 0, 0)

  await prisma.booking.create({
    data: {
      turfId: turf1.id,
      userId: user1.id,
      date: today,
      startTime: startTime,
      endTime: endTime,
      status: BookingStatus.CONFIRMED,
      holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      idempotencyKey: 'idemp_booking_001',
      payment: {
        create: {
          gatewayOrderId: 'order_pay_001',
          amount: 1500,
          status: PaymentStatus.SUCCEEDED,
          idempotencyKey: 'idemp_pay_001'
        }
      }
    }
  })

  await prisma.booking.create({
    data: {
      turfId: turf2.id,
      userId: user2.id,
      date: today,
      startTime: startTime,
      endTime: endTime,
      status: BookingStatus.HELD,
      holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      idempotencyKey: 'idemp_booking_002',
      payment: {
        create: {
          gatewayOrderId: 'order_pay_002',
          amount: 2000,
          status: PaymentStatus.PENDING,
          idempotencyKey: 'idemp_pay_002'
        }
      }
    }
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/*eslint-enable no-console*/
