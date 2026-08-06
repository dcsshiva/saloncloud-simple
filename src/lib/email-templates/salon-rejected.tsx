import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  salonName?: string
  ownerName?: string
  reason?: string
  dashboardUrl?: string
}

const SalonRejectedEmail = ({
  salonName = 'your salon',
  ownerName,
  reason,
  dashboardUrl = 'https://salon.vaanavil.org.in/app',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your SalonBook application</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>We couldn't approve your submission</Heading>
        <Text style={text}>{ownerName ? `Hi ${ownerName},` : 'Hi there,'}</Text>
        <Text style={text}>
          Your submission for <strong>{salonName}</strong> wasn't approved this
          time.
        </Text>
        {reason ? (
          <Text style={quote}>{reason}</Text>
        ) : null}
        <Text style={text}>
          You can fix the issue and upload a new payment proof from your
          dashboard — it goes straight back into the review queue.
        </Text>
        <Button style={button} href={dashboardUrl}>
          Re-submit payment proof
        </Button>
        <Text style={footer}>
          Reply to this email if you think this was a mistake.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SalonRejectedEmail,
  subject: 'Update on your SalonBook application',
  displayName: 'Salon submission rejected',
  previewData: {
    salonName: 'Glow Studio',
    ownerName: 'Priya',
    reason: 'The payment screenshot was unreadable.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3a1b2c', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const quote = {
  fontSize: '14px',
  color: '#3a1b2c',
  lineHeight: '1.5',
  borderLeft: '3px solid #7b2c56',
  padding: '4px 0 4px 12px',
  margin: '0 0 20px',
}
const button = {
  backgroundColor: '#7b2c56',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
