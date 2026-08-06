import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  code?: string
  salonName?: string
}

const SignupOtpEmail = ({ code = '0000', salonName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your SalonBook verification code is {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Verify your email</Heading>
        <Text style={text}>
          {salonName
            ? `Use the code below to finish registering ${salonName} on SalonBook.`
            : 'Use the code below to finish registering your salon on SalonBook.'}
        </Text>
        <Text style={codeStyle}>{code}</Text>
        <Text style={footer}>
          This code expires in 10 minutes. If you didn't request it, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupOtpEmail

export const template: TemplateEntry = {
  component: SignupOtpEmail,
  subject: (data) => `${data['code'] ?? ''} is your SalonBook verification code`,
  displayName: 'Signup email verification',
  previewData: { code: '4821', salonName: 'Luxe Hair Studio' },
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#3a1b2c', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const codeStyle = {
  fontSize: '34px',
  letterSpacing: '10px',
  fontWeight: 'bold' as const,
  color: '#7b2c56',
  margin: '0 0 24px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
