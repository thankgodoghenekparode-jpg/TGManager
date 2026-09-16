import { useQuery, useQueries } from '@tanstack/react-query'
import { formsApi, type FormDef, type FormSubmission } from '../api/forms'

/**
 * All Customer Ticket submissions across every Customer Ticket form, used by
 * the ticket picker on child (bundled) forms. Also returns the ticket forms so
 * the picker can create a new ticket inline.
 */
export function useCustomerTickets() {
  const ticketFormsQuery = useQuery({ queryKey: ['forms'], queryFn: () => formsApi.list() })
  const ticketForms: FormDef[] = (ticketFormsQuery.data ?? []).filter((f) => f.isCustomerTicket)

  const submissions = useQueries({
    queries: ticketForms.map((f) => ({
      queryKey: ['formSubmissions', f.id],
      queryFn: () => formsApi.listSubmissions(f.id),
    })),
  })

  const tickets: FormSubmission[] = submissions.flatMap((q) => q.data ?? [])
  const loading = ticketFormsQuery.isLoading || submissions.some((q) => q.isFetching)

  return { tickets, loading, ticketForms }
}