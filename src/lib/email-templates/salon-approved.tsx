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
  planName?: string
  endDate?: string
  dashboardUrl?: string
}

const SalonApprovedEmail = ({
  salonName = 'your salon',
  ownerName,
  planName,
  endDate,
  dashboardUrl = 'https://salon.vaanavil.org.in/app',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{salonName} is approved and live on SalonBook</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your salon is approved</Heading>
        <Text style={text}>
          {ownerName ? `Hi ${ownerName},` : 'Hi there,'}
        </Text>
        <Text style={text}>
          <strong>{salonName}</strong> has been approved. Your public booking
          page is live and customers can start requesting appointments right
          away.
        </Text>
        {planName ? (
          <Text style={text}>
            Plan: <strong>{planName}</strong>
            {endDate ? ` — active until ${endDate}` : ''}
          </Text>
        ) : null}
        <Button style={button} href={dashboardUrl}>
          Open your dashboard
        </Button>
        <Text style={footer}>
          Set your working hours, services and location pin so customers see
          accurate slots.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SalonApprovedEmail,
  subject: 'Your salon is approved on SalonBook',
  displayName: 'Salon approved',
  previewData: {
    salonName: 'Glow Studio',
    ownerName: 'Priya',
    planName: 'Monthly',
    endDate: '2026-09-05',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3a1b2c', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const button = {
  backgroundColor: '#7b2c56',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
