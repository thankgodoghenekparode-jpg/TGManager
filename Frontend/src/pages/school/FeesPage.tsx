import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
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
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Tab,
  Tabs,
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import {
  schoolApi,
  type FeeStructure,
  type StudentInvoice,
  type SchoolPayment,
} from '../../api/school';
import { useTenantStore } from '../../store/tenant';
import { tenantLogoUrl, apiErrorMessage } from '../../api/client';
import { useCan } from '../../components/PermissionGate';
import { DocumentActions } from '../../components/documents/DocumentActions';
import { DocumentFooter, DocumentHeader, DocumentPaper } from '../../components/documents/DocumentPaper';

const FEE_CATEGORIES = [
  'TUITION',
  'DEVELOPMENT',
  'FACILITIES',
  'LIBRARY',
  'SPORTS',
  'ICT',
  'UNIFORM',
  'BOOKS',
  'BOARDING',
  'EXAMINATION',
  'TRANSPORT',
  'OTHER',
];

const naira = (value: number) => `₦${(value ?? 0).toLocaleString()}`;

interface FeeFormState {
  name: string;
  category: string;
  amount: number;
}

const emptyFeeForm: FeeFormState = { name: '', category: 'TUITION', amount: 0 };

export function FeesPage() {
  const qc = useQueryClient();
  const tenant = useTenantStore((s) => s.current);
  const tenantLogo = tenantLogoUrl(tenant?.id, tenant?.logoKey);
  const canManageFees = useCan('school_fee.manage');

  const [activeTab, setActiveTab] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<StudentInvoice | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [historyInvoice, setHistoryInvoice] = useState<StudentInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Fee schedule dialog state
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [feeForm, setFeeForm] = useState<FeeFormState>(emptyFeeForm);

  // Payments ledger tab pagination
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerLimit, setLedgerLimit] = useState(20);

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
    queryFn: () => schoolApi.listInvoices(),
  });

  const { data: revenueStats } = useQuery({
    queryKey: ['school', 'fees', 'stats'],
    queryFn: () => schoolApi.getRevenueStats(),
  });

  const { data: ledger } = useQuery({
    queryKey: ['school', 'payments', ledgerPage, ledgerLimit],
    queryFn: () =>
      schoolApi.listPayments({ page: ledgerPage + 1, limit: ledgerLimit }),
    enabled: activeTab === 2,
  });

  const { data: invoicePayments } = useQuery({
    queryKey: ['school', 'payments', 'invoice', historyInvoice?.id],
    queryFn: () =>
      schoolApi.listPayments({ invoiceId: historyInvoice!.id, limit: 100 }),
    enabled: !!historyInvoice,
  });

  const invoices = invoicesData?.items ?? [];

  const saveFeeMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: feeForm.name.trim(),
        category: feeForm.category,
        amount: Number(feeForm.amount),
      };
      if (editingFee) {
        return schoolApi.updateFeeStructure(editingFee.id, payload);
      }
      return schoolApi.createFeeStructure(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'fees', 'structures'] });
      setFeeDialogOpen(false);
      setEditingFee(null);
      setFeeForm(emptyFeeForm);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deleteFeeMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteFeeStructure(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'fees', 'structures'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

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
      qc.invalidateQueries({ queryKey: ['school', 'payments'] });
      setPaymentOpen(false);
      setReceiptOpen(true);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCreateFee = () => {
    setEditingFee(null);
    setFeeForm(emptyFeeForm);
    setError(null);
    setFeeDialogOpen(true);
  };

  const openEditFee = (fee: FeeStructure) => {
    setEditingFee(fee);
    setFeeForm({ name: fee.name, category: fee.category, amount: fee.amount });
    setError(null);
    setFeeDialogOpen(true);
  };

  const totalBilled = revenueStats?.totalInvoiced ?? 0;
  const totalCollected = revenueStats?.totalCollected ?? 0;
  const totalOutstanding = revenueStats?.totalOutstanding ?? (totalBilled - totalCollected);

  const invoicePaymentCount = useMemo(
    () => (inv: StudentInvoice) => inv._count?.payments ?? inv.payments?.length ?? 0,
    [],
  );

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

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Financial Overview Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                Total Billed
              </Typography>
              <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                {naira(totalBilled)}
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
                {naira(totalCollected)}
              </Typography>
              <Typography variant="caption" color="success.main" fontWeight={600}>
                {totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0}% collection rate
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
                {naira(totalOutstanding)}
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
          <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Payments Ledger" />
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
                  <TableCell align="center">Payments</TableCell>
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
                      <Chip label={inv.student.currentClass?.name ?? '—'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{naira(inv.totalAmount)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        {naira(inv.paidAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={inv.balance > 0 ? 'warning.main' : 'text.secondary'} fontWeight={600}>
                        {naira(inv.balance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View payment history">
                        <Chip
                          label={`${invoicePaymentCount(inv)} payment${invoicePaymentCount(inv) === 1 ? '' : 's'}`}
                          size="small"
                          color={invoicePaymentCount(inv) > 0 ? 'primary' : 'default'}
                          variant={invoicePaymentCount(inv) > 0 ? 'filled' : 'outlined'}
                          onClick={() => setHistoryInvoice(inv)}
                          sx={{ fontWeight: 700, cursor: 'pointer' }}
                        />
                      </Tooltip>
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
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<HistoryIcon />}
                          onClick={() => setHistoryInvoice(inv)}
                          sx={{ textTransform: 'none' }}
                        >
                          History
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No invoices yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 1: Fee Schedules & Levies */}
      {activeTab === 1 && (
        <Card>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Fee Schedule &amp; Levies
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Define tuition and levies. School admins can edit or remove any item.
              </Typography>
            </Box>
            {canManageFees && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateFee} sx={{ textTransform: 'none' }}>
                Add Fee / Levy
              </Button>
            )}
          </Stack>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Fee Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Standard Amount (₦)</TableCell>
                  <TableCell>Frequency / Due</TableCell>
                  <TableCell align="right">Actions</TableCell>
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
                        {naira(fee.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        Every Academic Term
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {canManageFees ? (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditFee(fee)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                if (window.confirm(`Delete "${fee.name}"? Existing invoices keep their charges.`)) {
                                  deleteFeeMutation.mutate(fee.id);
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          View only
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(feeStructures || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No fee schedule items yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 2: Payments Ledger */}
      {activeTab === 2 && (
        <Card>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                All Fee Payments
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ledger?.total ?? 0} payments recorded • {naira(ledger?.totalAmountPaid ?? 0)} collected
              </Typography>
            </Box>
          </Stack>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Receipt #</TableCell>
                  <TableCell>Student</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell align="right">Amount (₦)</TableCell>
                  <TableCell>Recorded By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(ledger?.items || []).map((p: SchoolPayment) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                        {p.receiptNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {p.student.firstName} {p.student.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.student.admissionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {p.invoice?.invoiceNumber ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={p.method.replace('_', ' ')} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {naira(p.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {p.recordedBy ? `${p.recordedBy.firstName} ${p.recordedBy.lastName}` : '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {(ledger?.items || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No payments recorded yet.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={ledger?.total ?? 0}
            page={ledgerPage}
            onPageChange={(_, p) => setLedgerPage(p)}
            rowsPerPage={ledgerLimit}
            onRowsPerPageChange={(e) => {
              setLedgerLimit(parseInt(e.target.value, 10));
              setLedgerPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </Card>
      )}

      {/* Fee Schedule create/edit dialog */}
      <Dialog open={feeDialogOpen} onClose={() => setFeeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingFee ? 'Edit Fee / Levy' : 'Add Fee / Levy'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Fee or Levy Name"
              placeholder="e.g. Term 2 Tuition Fee"
              value={feeForm.name}
              onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Category"
              value={feeForm.category}
              onChange={(e) => setFeeForm({ ...feeForm, category: e.target.value })}
            >
              {FEE_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Standard Amount (₦)"
              value={feeForm.amount}
              onChange={(e) => setFeeForm({ ...feeForm, amount: Number(e.target.value) })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setFeeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!feeForm.name.trim() || !feeForm.amount || saveFeeMutation.isPending}
            onClick={() => saveFeeMutation.mutate()}
          >
            {saveFeeMutation.isPending ? 'Saving...' : editingFee ? 'Save Changes' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment history dialog */}
      <Dialog open={!!historyInvoice} onClose={() => setHistoryInvoice(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Payment History
            </Typography>
            {historyInvoice && (
              <Typography variant="caption" color="text.secondary">
                {historyInvoice.student.firstName} {historyInvoice.student.lastName} • {historyInvoice.invoiceNumber}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setHistoryInvoice(null)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {historyInvoice && (
            <>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Chip label={`Total: ${naira(historyInvoice.totalAmount)}`} size="small" variant="outlined" />
                <Chip label={`Paid: ${naira(historyInvoice.paidAmount)}`} size="small" color="success" />
                <Chip label={`Balance: ${naira(historyInvoice.balance)}`} size="small" color="warning" />
              </Stack>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                {invoicePayments?.total ?? invoicePaymentCount(historyInvoice)} payment
                {(invoicePayments?.total ?? invoicePaymentCount(historyInvoice)) === 1 ? '' : 's'} recorded
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Receipt #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (₦)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(invoicePayments?.items || []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{p.receiptNumber}</TableCell>
                        <TableCell>{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                        <TableCell>{p.method.replace('_', ' ')}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {naira(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(invoicePayments?.items || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No payments recorded for this invoice yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setHistoryInvoice(null)}>Close</Button>
          <Stack direction="row" spacing={1}>
            {historyInvoice && historyInvoice.paidAmount > 0 && (
              <Button
                variant="outlined"
                startIcon={<ReceiptLongIcon />}
                onClick={() => {
                  setSelectedInvoice(historyInvoice);
                  setReceiptOpen(true);
                }}
              >
                View Receipt
              </Button>
            )}
            {historyInvoice && historyInvoice.balance > 0 && (
              <Button
                variant="contained"
                onClick={() => {
                  setSelectedInvoice(historyInvoice);
                  setPaymentForm({
                    amount: historyInvoice.balance,
                    paymentMethod: 'BANK_TRANSFER',
                    paymentReference: `TXN-REC-${Date.now().toString().slice(-6)}`,
                    notes: 'Term fee collection',
                  });
                  setPaymentOpen(true);
                }}
              >
                Record Payment
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>

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
                  Invoice: {selectedInvoice.invoiceNumber} • Outstanding: {naira(selectedInvoice.balance)}
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
              <DocumentHeader
                logoSrc={tenantLogo ?? undefined}
                icon={<ReceiptLongIcon sx={{ fontSize: 32 }} />}
                orgName={tenant?.name ?? 'School Workspace'}
                subtitle={`Bursar's Office • bursar@${tenant?.slug ?? 'school'}.tgmanager.app`}
                title="Official Payment Receipt"
                meta={[tenant?.schoolProfile?.address ?? 'School Campus']}
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
                  <Typography variant="body2" fontWeight={700}>{selectedInvoice.student.currentClass?.name ?? '—'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Invoice Reference:</Typography>
                  <Typography variant="body2" fontWeight={700}>{selectedInvoice.invoiceNumber}</Typography>
                </Grid>
              </Grid>

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
                        <TableCell align="right">{naira(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ borderTop: '2px solid #0f172a' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total Billed</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{naira(selectedInvoice.totalAmount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>Amount Received</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{naira(selectedInvoice.paidAmount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Balance Remaining</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{naira(selectedInvoice.balance)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

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
