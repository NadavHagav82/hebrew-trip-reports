import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type EntityType = 'employee_grade' | 'travel_rule' | 'restriction' | 'custom_rule';
type ActionType = 'create' | 'update' | 'delete' | 'activate' | 'deactivate';

interface LogEntryParams {
  organizationId: string;
  action: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export function usePolicyAuditLog() {
  const { user } = useAuth();

  const logChange = async ({
    organizationId,
    action,
    entityType,
    entityId,
    entityName,
    oldValues,
    newValues,
  }: LogEntryParams) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('policy_audit_log')
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName,
          old_values: oldValues,
          new_values: newValues,
        });

      if (error) {
        console.error('Error logging policy change:', error);
      }
    } catch (error) {
      console.error('Error logging policy change:', error);
    }
  };

  return { logChange };
}
