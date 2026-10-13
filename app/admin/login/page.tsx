import type { Metadata } from 'next'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'ورود مدیریت',
  description: 'ورود به پنل مدیریت کافه پارک',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function LoginPage() {
  return <LoginForm />
}