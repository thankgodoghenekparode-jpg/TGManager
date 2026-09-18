import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import ChatIcon from '@mui/icons-material/Chat'
import BarChartIcon from '@mui/icons-material/BarChart'
import SecurityIcon from '@mui/icons-material/Security'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SpeedIcon from '@mui/icons-material/Speed'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import HubIcon from '@mui/icons-material/Hub'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import { useAuthStore } from '../store/auth'
import { getTenantId } from '../api/client'
import { isPlatformAdmin } from '../store/tenant'

export function PortfolioPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleGetStarted = () => {
    if (user) {
      const isPlatform = isPlatformAdmin(user.role)
      navigate(isPlatform ? '/admin' : getTenantId() ? '/app' : '/select-company')
    } else {
      navigate('/login')
    }
  }

  return (
    <Box sx={{ bgcolor: '#010101', color: '#FFFFFF', minHeight: '100vh', position: 'relative', overflowX: 'hidden' }}>
      {/* ─── FULL-BLEED RADIANCE BACKGROUND ORBS ─── */}
      <Box
        className="radiance-bg-orb-1"
        sx={{
          position: 'absolute',
          top: '-10%',
          left: '15%',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236, 6, 24, 0.4) 0%, rgba(184, 0, 16, 0.18) 40%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        className="radiance-bg-orb-2"
        sx={{
          position: 'absolute',
          top: '35%',
          right: '-10%',
          width: 750,
          height: 750,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 51, 68, 0.28) 0%, rgba(133, 0, 10, 0.2) 45%, transparent 75%)',
          filter: 'blur(85px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '10%',
          left: '-5%',
          width: 650,
          height: 650,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236, 6, 24, 0.25) 0%, transparent 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Cyber Grid Background Overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(236, 6, 24, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(236, 6, 24, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ─── STICKY GLASS NAVBAR ─── */}
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          transition: 'all 0.3s ease',
          bgcolor: scrolled ? 'rgba(1, 1, 1, 0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(236, 6, 24, 0.25)' : '1px solid transparent',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* Brand Monogram & Title */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2.5,
                  background: 'linear-gradient(135deg, #EC0618 0%, #88000A 100%)',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 18px rgba(236, 6, 24, 0.6)',
                }}
              >
                TG
              </Box>
              <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                TGManager
              </Typography>
            </Stack>

            {/* Desktop Navigation Links */}
            <Stack direction="row" spacing={3.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#cockpit">Cockpit</NavLink>
              <NavLink href="#architecture">Architecture</NavLink>
              <NavLink href="#pricing">Plans</NavLink>
              <NavLink href="#security">Security</NavLink>
            </Stack>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  display: { xs: 'none', sm: 'inline-flex' },
                  borderColor: 'rgba(236, 6, 24, 0.5)',
                  color: '#FFFFFF',
                  borderRadius: 3,
                  px: 2.5,
                  '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.1)' },
                }}
              >
                {user ? 'Open App' : 'Sign In'}
              </Button>
              <Button
                variant="contained"
                onClick={handleGetStarted}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  borderRadius: 3,
                  px: 3,
                  fontWeight: 800,
                }}
              >
                Get Started
              </Button>

              {/* Mobile Menu Toggle */}
              <IconButton
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                sx={{ display: { md: 'none' }, color: '#FFFFFF' }}
              >
                {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
              </IconButton>
            </Stack>
          </Stack>
        </Container>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <Box
            sx={{
              display: { md: 'none' },
              bgcolor: 'rgba(10, 11, 14, 0.98)',
              borderBottom: '1px solid rgba(236, 6, 24, 0.3)',
              px: 3,
              py: 2.5,
              mt: 1.5,
            }}
          >
            <Stack spacing={2}>
              <MobileNavLink href="#features" onClick={() => setMobileMenuOpen(false)}>Features</MobileNavLink>
              <MobileNavLink href="#cockpit" onClick={() => setMobileMenuOpen(false)}>Cockpit</MobileNavLink>
              <MobileNavLink href="#architecture" onClick={() => setMobileMenuOpen(false)}>Architecture</MobileNavLink>
              <MobileNavLink href="#pricing" onClick={() => setMobileMenuOpen(false)}>Plans</MobileNavLink>
              <MobileNavLink href="#security" onClick={() => setMobileMenuOpen(false)}>Security</MobileNavLink>
              <Button variant="outlined" fullWidth onClick={() => { setMobileMenuOpen(false); navigate('/login') }}>
                Sign In
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      {/* ─── HERO SECTION ─── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 18, sm: 22, md: 24 }, pb: { xs: 10, md: 14 }, position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <Chip
          label="Enterprise Operations & Workforce Operating System"
          size="small"
          sx={{
            mb: 3,
            bgcolor: 'rgba(236, 6, 24, 0.15)',
            color: '#FF6B7A',
            border: '1px solid rgba(236, 6, 24, 0.4)',
            fontWeight: 800,
            fontSize: '0.82rem',
            boxShadow: '0 0 20px rgba(236, 6, 24, 0.3)',
            py: 0.5,
            px: 1,
          }}
        />

        <Typography
          variant="h1"
          className="text-gradient-radiance"
          sx={{
            fontSize: { xs: '2.4rem', sm: '3.6rem', md: '4.5rem' },
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: '-0.035em',
            maxWidth: 960,
            mx: 'auto',
            mb: 3,
          }}
        >
          Run your entire company in one radiant workspace.
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: '1.05rem', sm: '1.25rem' },
            color: '#9CA3AF',
            maxWidth: 720,
            mx: 'auto',
            mb: 5,
            lineHeight: 1.6,
          }}
        >
          Unify multi-branch attendance, hardware-backed biometrics, audited approval workflows, encrypted team chat, and real-time operations across your enterprise.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mb: 8 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleGetStarted}
            endIcon={<ArrowForwardIcon />}
            sx={{
              py: 1.6,
              px: 4,
              fontSize: '1.05rem',
              fontWeight: 800,
              boxShadow: '0 10px 30px rgba(236, 6, 24, 0.65)',
            }}
          >
            Get Started / Login
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              const el = document.getElementById('features')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}
            sx={{
              py: 1.6,
              px: 3.5,
              fontSize: '1.05rem',
              fontWeight: 700,
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.08)' },
            }}
          >
            Explore Platform Features
          </Button>
        </Stack>

        {/* ─── COCKPIT PREVIEW / DASHBOARD SHOWCASE ─── */}
        <Box
          id="cockpit"
          sx={{
            position: 'relative',
            maxWidth: 1060,
            mx: 'auto',
            borderRadius: 4,
            p: 1.5,
            bgcolor: 'rgba(23, 25, 28, 0.65)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(236, 6, 24, 0.35)',
            boxShadow: '0 30px 80px -15px rgba(236, 6, 24, 0.3), 0 0 40px rgba(0, 0, 0, 0.9)',
          }}
        >
          <Box sx={{ borderRadius: 3, bgcolor: '#0D0E11', border: '1px solid #2D3035', overflow: 'hidden', textAlign: 'left', p: { xs: 2.5, sm: 4 } }}>
            {/* Cockpit Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#EC0618', boxShadow: '0 0 10px #EC0618' }} />
                <Typography variant="h6" fontWeight={800} color="#FFFFFF">
                  TGManager Cockpit • Live System Operational
                </Typography>
              </Stack>
              <Chip
                icon={<SpeedIcon sx={{ color: '#10B981 !important', fontSize: 16 }} />}
                label="System Health: Optimal"
                size="small"
                sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#34D399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700 }}
              />
            </Stack>

            {/* KPI Metric Cards */}
            <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
              <Grid item xs={6} sm={3}>
                <CockpitKpi label="Active Staff" value="142" sub="+12 this week" color="#EC0618" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <CockpitKpi label="On-Time Attendance" value="98.8%" sub="Hardware verified" color="#10B981" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <CockpitKpi label="Active Branches" value="8" sub="Multi-region hubs" color="#38BDF8" />
              </Grid>
              <Grid item xs={6} sm={3}>
                <CockpitKpi label="Pending Workflows" value="4" sub="1 hr avg turnaround" color="#F59E0B" />
              </Grid>
            </Grid>

            {/* Action Bar inside Cockpit */}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#17191C', border: '1px solid rgba(236, 6, 24, 0.2)' }}>
              <Typography variant="body2" sx={{ color: '#D1D5DB' }}>
                Hardware Biometric Terminal • GPS Geofenced Clock-in Ready
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate('/login')}
                sx={{ mt: { xs: 1.5, sm: 0 }, px: 2.5 }}
              >
                Launch Workspace
              </Button>
            </Stack>
          </Box>
        </Box>
      </Container>

      {/* ─── FEATURE BENTO GRID ─── */}
      <Box id="features" sx={{ py: { xs: 10, md: 14 }, bgcolor: '#050608', borderTop: '1px solid rgba(236, 6, 24, 0.15)', borderBottom: '1px solid rgba(236, 6, 24, 0.15)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="caption" sx={{ color: '#FF4D5E', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Comprehensive Enterprise Architecture
            </Typography>
            <Typography variant="h2" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 1, mb: 2 }}>
              Everything your organization needs in one place.
            </Typography>
            <Typography variant="body1" sx={{ color: '#9CA3AF', maxWidth: 640, mx: 'auto' }}>
              Built specifically for modern distributed workforces requiring strict accountability, compliance, and instant communication.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FeatureCard
                icon={<FingerprintIcon sx={{ fontSize: 32, color: '#EC0618' }} />}
                title="Biometric & GPS Clock-In"
                description="Hardware-backed WebAuthn fingerprint authentication, camera face check, and real-time browser GPS geofencing radius validation."
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FeatureCard
                icon={<PlaylistAddCheckIcon sx={{ fontSize: 32, color: '#EC0618' }} />}
                title="Audited Approval Workflows"
                description="Dynamic multi-tier requisition pipelines, electronic signatures, custom forms, and automated manager sign-offs with audit logs."
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FeatureCard
                icon={<ChatIcon sx={{ fontSize: 32, color: '#EC0618' }} />}
                title="Encrypted Real-Time Chat"
                description="High-speed Socket.io communications, private direct messages, broadcast notices, voice audio memos, and attachment vaults."
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FeatureCard
                icon={<ApartmentIcon sx={{ fontSize: 32, color: '#EC0618' }} />}
                title="Multi-Branch & Department Roaming"
                description="Manage unlimited branches, customized shifts, department groups, and employee roster schedules across multiple timezones."
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FeatureCard
                icon={<BarChartIcon sx={{ fontSize: 32, color: '#EC0618' }} />}
                title="Executive Reports & Analytics"
                description="Automated weekly operational digests, attendance trends, staff productivity KPIs, and one-click CSV report exports."
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FeatureCard
                icon={<Inventory2Icon sx={{ fontSize: 32, color: '#EC0618' }} />}
                title="Smart Inventory Tracking"
                description="Real-time stock level monitoring with automated minimum reorder threshold alarms and branch distribution tracking."
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── ARCHITECTURE & SECURITY ─── */}
      <Box id="security" sx={{ py: { xs: 10, md: 14 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="caption" sx={{ color: '#FF4D5E', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Enterprise Grade
              </Typography>
              <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 1, mb: 3 }}>
                Engineered for security, scale, and compliance.
              </Typography>
              <Typography variant="body1" sx={{ color: '#9CA3AF', mb: 4, lineHeight: 1.7 }}>
                TGManager is built on a resilient NestJS + PostgreSQL + React architecture, ensuring complete multi-tenant tenant isolation and zero data leakage.
              </Typography>

              <Stack spacing={2.5}>
                {[
                  'Multi-Tenant Tenant Isolation & Strict Boundaries',
                  'Granular Role-Based Access Control (RBAC) with Custom Roles',
                  'Hardware-Ready Biometric Identity Verification Protocols',
                  'Immutable Audit Trail for Every Workflow & Authorization',
                ].map((text) => (
                  <Stack key={text} direction="row" spacing={1.5} alignItems="center">
                    <CheckCircleIcon sx={{ color: '#EC0618' }} />
                    <Typography variant="body2" fontWeight={600} color="#F3F4F6">
                      {text}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card
                className="auth-radiant-card"
                sx={{
                  borderRadius: 4,
                  p: { xs: 3, sm: 4.5 },
                }}
              >
                <Stack spacing={3}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(236, 6, 24, 0.15)', color: '#EC0618', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SecurityIcon />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="#FFFFFF">
                        AES-256 Vault Encryption
                      </Typography>
                      <Typography variant="caption" color="#9CA3AF">
                        At rest and in transit
                      </Typography>
                    </Box>
                  </Stack>
                  <Divider sx={{ borderColor: 'rgba(236, 6, 24, 0.2)' }} />
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HubIcon />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="#FFFFFF">
                        WebSocket Live Sync
                      </Typography>
                      <Typography variant="caption" color="#9CA3AF">
                        Sub-second real-time event distribution
                      </Typography>
                    </Box>
                  </Stack>
                  <Divider sx={{ borderColor: 'rgba(236, 6, 24, 0.2)' }} />
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LocationOnIcon />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={800} color="#FFFFFF">
                        Branch Geo-Fencing Engine
                      </Typography>
                      <Typography variant="caption" color="#9CA3AF">
                        Automated boundary verification
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── PRICING / PLANS SECTION ─── */}
      <Box id="pricing" sx={{ py: { xs: 10, md: 14 }, bgcolor: '#050608', borderTop: '1px solid rgba(236, 6, 24, 0.15)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="caption" sx={{ color: '#FF4D5E', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Scalable Pricing
            </Typography>
            <Typography variant="h2" fontWeight={900} sx={{ letterSpacing: '-0.02em', mt: 1, mb: 2 }}>
              Simple, transparent plans for every scale.
            </Typography>
            <Typography variant="body1" sx={{ color: '#9CA3AF', maxWidth: 600, mx: 'auto' }}>
              Choose the tier that matches your workforce size and operations requirements.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <PricingCard
                name="Free"
                price="$0"
                period="/ month"
                description="Essential workforce tools for small businesses."
                features={['1 Branch Location', 'Up to 10 Staff Members', 'Real-Time Team Chat', 'Attendance Tracking', 'Basic Approvals']}
                onSelect={handleGetStarted}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <PricingCard
                featured
                name="Pro"
                price="$49"
                period="/ month"
                description="Complete operational power for growing teams."
                features={['Up to 5 Branches', 'Up to 100 Staff Members', 'Biometric & GPS Clock-In', 'Custom Approval Workflows', 'Smart Inventory System', 'Weekly Report Analytics']}
                onSelect={handleGetStarted}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <PricingCard
                name="Enterprise"
                price="$149"
                period="/ month"
                description="Unlimited scale, multi-region control & audit."
                features={['Unlimited Branches', 'Unlimited Staff Members', 'Dedicated Priority SLA', 'Full Audit Logging', 'Custom Integration APIs', 'Hardware Biometrics Integration']}
                onSelect={handleGetStarted}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ─── BOTTOM CTA BANNER ─── */}
      <Container maxWidth="lg" sx={{ py: { xs: 10, md: 14 } }}>
        <Box
          sx={{
            borderRadius: 4,
            p: { xs: 4, sm: 6, md: 8 },
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'radial-gradient(circle at 50% 50%, #200407 0%, #0D0E11 100%)',
            border: '1px solid rgba(236, 6, 24, 0.4)',
            boxShadow: '0 20px 60px -15px rgba(236, 6, 24, 0.35)',
          }}
        >
          <Typography variant="h3" fontWeight={900} sx={{ color: '#FFFFFF', letterSpacing: '-0.02em', mb: 2 }}>
            Ready to streamline your entire company?
          </Typography>
          <Typography variant="body1" sx={{ color: '#9CA3AF', maxWidth: 600, mx: 'auto', mb: 4 }}>
            Get started today with TGManager. Access your organizational workspace and unlock full operational control.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleGetStarted}
            endIcon={<ArrowForwardIcon />}
            sx={{
              py: 1.8,
              px: 4.5,
              fontSize: '1.1rem',
              fontWeight: 800,
              boxShadow: '0 10px 30px rgba(236, 6, 24, 0.75)',
            }}
          >
            Get Started / Sign In
          </Button>
        </Box>
      </Container>

      {/* ─── FOOTER ─── */}
      <Box component="footer" sx={{ borderTop: '1px solid #2D3035', py: 5, bgcolor: '#050608' }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: '#EC0618', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                TG
              </Box>
              <Typography variant="subtitle1" fontWeight={800} color="#FFFFFF">
                TGManager
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
              © {new Date().getFullYear()} TGManager. All rights reserved. Enterprise Workforce Cloud.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Typography
      component="a"
      href={href}
      sx={{
        color: '#D1D5DB',
        fontWeight: 600,
        fontSize: '0.92rem',
        textDecoration: 'none',
        transition: 'color 0.2s ease',
        '&:hover': { color: '#EC0618' },
      }}
    >
      {children}
    </Typography>
  )
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Typography
      component="a"
      href={href}
      onClick={onClick}
      sx={{
        color: '#FFFFFF',
        fontWeight: 700,
        fontSize: '1.05rem',
        textDecoration: 'none',
        py: 0.5,
        display: 'block',
      }}
    >
      {children}
    </Typography>
  )
}

function CockpitKpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#17191C', border: '1px solid #2D3035' }}>
      <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={900} sx={{ color, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 0.5 }}>
        {sub}
      </Typography>
    </Box>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        bgcolor: '#17191C',
        borderColor: '#2D3035',
        borderRadius: 3.5,
        p: 1,
        transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'rgba(236, 6, 24, 0.5)',
          boxShadow: '0 12px 30px -10px rgba(236, 6, 24, 0.25)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Box sx={{ mb: 2 }}>{icon}</Box>
        <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF', mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: '#9CA3AF', lineHeight: 1.6 }}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  )
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  featured,
  onSelect,
}: {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  featured?: boolean
  onSelect: () => void
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 4,
        bgcolor: featured ? '#1C1618' : '#17191C',
        borderColor: featured ? '#EC0618' : '#2D3035',
        boxShadow: featured ? '0 12px 40px -10px rgba(236, 6, 24, 0.4)' : 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {featured && (
        <Chip
          label="Most Popular"
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            bgcolor: '#EC0618',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.72rem',
          }}
        />
      )}

      <CardContent sx={{ p: { xs: 3, sm: 4 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h5" fontWeight={800} sx={{ color: '#FFFFFF', mb: 0.5 }}>
          {name}
        </Typography>
        <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
          {description}
        </Typography>

        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 3 }}>
          <Typography variant="h3" fontWeight={900} sx={{ color: featured ? '#FF4D5E' : '#FFFFFF' }}>
            {price}
          </Typography>
          <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
            {period}
          </Typography>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }} />

        <Stack spacing={1.5} sx={{ mb: 4, flex: 1 }}>
          {features.map((f) => (
            <Stack key={f} direction="row" spacing={1.25} alignItems="center">
              <CheckCircleIcon sx={{ color: featured ? '#EC0618' : '#10B981', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: '#D1D5DB' }}>
                {f}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Button
          variant={featured ? 'contained' : 'outlined'}
          fullWidth
          size="large"
          onClick={onSelect}
          sx={{
            borderRadius: 3,
            fontWeight: 800,
            py: 1.4,
          }}
        >
          Get Started
        </Button>
      </CardContent>
    </Card>
  )
}
