import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tab,
  Tabs,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CloseIcon from '@mui/icons-material/Close';
import { schoolApi, type StudentInvoice } from '../../api/school';
import { useTenantStore } from '../../store/tenant';
import { tenantLogoUrl } from '../../api/client';
import { DocumentActions } from '../../components/documents/DocumentActions';
import { DocumentFooter, DocumentHeader, DocumentPaper } from '../../components/documents/DocumentPaper';

export function FeesPage() {
  const qc = useQueryClient();
  const tenant = useTenantStore((s) => s.current);
  const tenantLogo = tenantLogoUrl(tenant?.id, tenant?.logoKey);

  const [activeTab, setActiveTab] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<StudentInvoice | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: 50000,
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    notes: 'Term fee payment',
  });

  const { data: feeStructures } = useQuery({
    queryKey: ['school', 'fees', 'structures'],
    queryFn: () => schoolApi.listFeeStructures(),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['school', 'invoices'],
    queryFn: () => schoolApi.listInvoices({ limit: 100 } as any),
  });

  const { data: revenueStats } = useQuery({
    queryKey: ['school', 'fees', 'stats'],
    queryFn: () => schoolApi.getRevenueStats(),
  });

  const invoices = invoicesData?.items ?? [];

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) return;
      return schoolApi.recordPayment({
        invoiceId: selectedInvoice.id,
        amount: Number(paymentForm.amount),
        method: paymentForm.paymentMethod as
          | 'CASH'
          | 'BANK_TRANSFER'
          | 'POS'
          | 'ONLINE'
          | 'OTHER',
        notes: paymentForm.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'invoices'] });
      qc.invalidateQueries({ queryKey: ['school', 'fees', 'stats'] });
      setPaymentOpen(false);
      setReceiptOpen(true);
    },
  });

  const totalBilled = revenueStats?.totalInvoiced ?? 3300000;
  const totalCollected = revenueStats?.totalCollected ?? 1700000;
  const totalOutstanding = revenueStats?.totalOutstanding ?? (totalBilled - totalCollected);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Title */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            School Fees & Invoicing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fee schedule setup, student term billing, payment collection, and receipts
          </Typography>
        </Box>
      </Stack>

      {/* Financial Overview Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Billed (Term 2)
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                ₦{totalBilled.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {invoices.length} active student invoices
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Collected Revenue
              </Typography>
              <Typography variant="h4" fontWeight={700} color="success.main" sx={{ mt: 0.5 }}>
                ₦{totalCollected.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="success.main" fontWeight={600}>
                {Math.round((totalCollected / (totalBilled || 1)) * 100)}% collection rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Outstanding Balances
              </Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main" sx={{ mt: 0.5 }}>
                ₦{totalOutstanding.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pending collection
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ px: 2, pt: 1 }}>
          <Tab icon={<ReceiptLongIcon fontSize="small" />} iconPosition="start" label="Student Invoices & Payments" />
          <Tab icon={<PaymentsIcon fontSize="small" />} iconPosition="start" label="Fee Schedule & Levies" />
        </Tabs>
      </Card>

      {/* Tab 0: Student Invoices */}
      {activeTab === 0 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Student</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell align="right">Total (₦)</TableCell>
                  <TableCell align="right">Paid (₦)</TableCell>
                  <TableCell align="right">Balance (₦)</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                        {inv.invoiceNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {inv.student.firstName} {inv.student.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {inv.student.admissionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={inv.student.currentClass?.name ?? 'JSS 1'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">₦{inv.totalAmount.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        ₦{inv.paidAmount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={inv.balance > 0 ? 'warning.main' : 'text.secondary'} fontWeight={600}>
                        ₦{inv.balance.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={inv.status}
                        size="small"
                        color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'error'}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {inv.balance > 0 && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentForm({
                                amount: inv.balance,
                                paymentMethod: 'BANK_TRANSFER',
                                paymentReference: `TXN-REC-${Date.now().toString().slice(-6)}`,
                                notes: 'Term fee collection',
                              });
                              setPaymentOpen(true);
                            }}
                            sx={{ textTransform: 'none' }}
                          >
                            Pay Fee
                          </Button>
                        )}
                        {inv.paidAmount > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReceiptLongIcon />}
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setReceiptOpen(true);
                            }}
                            sx={{ textTransform: 'none' }}
                          >
                            Receipt
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 1: Fee Schedules */}
      {activeTab === 1 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fee Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Standard Amount (₦)</TableCell>
                  <TableCell>Frequency / Due</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(feeStructures || []).map((fee) => (
                  <TableRow key={fee.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {fee.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={fee.category} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700}>
                        ₦{fee.amount.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        Every Academic Term
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={paymentOpen} onClose={() => setPaymentOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Record Fee Payment</DialogTitle>
        <DialogContent dividers>
          {selectedInvoice && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Typography variant="body2" fontWeight={700}>
                  {selectedInvoice.student.firstName} {selectedInvoice.student.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Invoice: {selectedInvoice.invoiceNumber} • Outstanding: ₦{selectedInvoice.balance.toLocaleString()}
                </Typography>
              </Box>

              <TextField
                fullWidth
                size="small"
                type="number"
                label="Payment Amount (₦)"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              />

              <TextField
                select
                fullWidth
                size="small"
                label="Payment Method"
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              >
                <MenuItem value="BANK_TRANSFER">Bank Transfer (NIBSS / Instant)</MenuItem>
                <MenuItem value="POS">POS Terminal Card</MenuItem>
                <MenuItem value="CASH">Cash at Bursar Office</MenuItem>
                <MenuItem value="ONLINE">Online Portal</MenuItem>
              </TextField>

              <TextField
                fullWidth
                size="small"
                label="Transaction / Bank Reference"
                value={paymentForm.paymentReference}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!paymentForm.amount || paymentMutation.isPending}
            onClick={() => paymentMutation.mutate()}
          >
            {paymentMutation.isPending ? 'Processing...' : 'Confirm & Generate Receipt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Official Printable Receipt Modal */}
      <Dialog open={receiptOpen} onClose={() => setReceiptOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>
            Official Payment Receipt
          </Typography>
          <IconButton onClick={() => setReceiptOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3, bgcolor: '#ffffff' }}>
          {selectedInvoice && (
            <DocumentPaper
              id="receipt-print"
              ref={receiptRef}
              className="doc-sheet"
              watermark={tenant?.name ?? undefined}
            >
              {/* Receipt Header */}
              <DocumentHeader
                logoSrc={tenantLogo ?? undefined}
                icon={<ReceiptLongIcon sx={{ fontSize: 32 }} />}
                orgName={tenant?.name ?? 'School Workspace'}
                subtitle={`Bursar's Office • bursar@${tenant?.slug ?? 'school'}.tgmanager.app`}
                title="Official Payment Receipt"
                meta={['Plot 14, Commercial Avenue, Ikeja, Lagos']}
                right={
                  <>
                    <Typography variant="body2" fontWeight={800} sx={{ fontFamily: 'monospace' }}>
                      REC-{Date.now().toString().slice(-6)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Date: {new Date().toLocaleDateString()}
                    </Typography>
                  </>
                }
              />

              {/* Student info */}
              <Grid container spacing={1.5} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Student Name:</Typography>
                  <Typography variant="body2" fontWeight={700}>{selectedInvoice.student.firstName} {selectedInvoice.student.lastName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Admission Number:</Typography>
                  <Typography variant="body2" fontWeight={700}>{selectedInvoice.student.admissionNumber}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Class:</Typography>
                  <Typography variant="body2" fontWeight={700}>{selectedInvoice.student.currentClass?.name ?? 'JSS 1'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Invoice Reference:</Typography>
                  <Typography variant="body2" fontWeight={700}>{selectedInvoice.invoiceNumber}</Typography>
                </Grid>
              </Grid>

              {/* Items */}
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (₦)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedInvoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">₦{item.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ borderTop: '2px solid #0f172a' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total Billed</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>₦{selectedInvoice.totalAmount.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>Amount Received</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>₦{selectedInvoice.paidAmount.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Balance Remaining</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>₦{selectedInvoice.balance.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Sign-off */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2.5 }}>
                <Chip label="PAYMENT CONFIRMED" color="success" size="small" sx={{ fontWeight: 700 }} />
              </Stack>

              <DocumentFooter
                signatureLabel="Authorized Bursar Stamp"
                note="This receipt is computer-generated and valid without a physical signature. Retain for your records."
                reference={selectedInvoice.invoiceNumber}
              />
            </DocumentPaper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setReceiptOpen(false)}>Close</Button>
          <DocumentActions
            targetRef={receiptRef}
            fileBaseName={`Receipt-${selectedInvoice?.invoiceNumber ?? 'invoice'}`}
            title={`${tenant?.name ?? 'School'} — Payment Receipt`}
            message={`${tenant?.name ?? 'School'}\nPayment receipt ${selectedInvoice?.invoiceNumber ?? ''} for ${selectedInvoice?.student.firstName ?? ''} ${selectedInvoice?.student.lastName ?? ''}.`}
            disabled={!selectedInvoice}
            size="small"
          />
        </DialogActions>
      </Dialog>
    </Box>
  );
}
