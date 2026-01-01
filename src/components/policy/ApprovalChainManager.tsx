import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Users, Building, Calculator, User, ArrowDown, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ApprovalChainLevel {
  id: string;
  chain_id: string;
  level_order: number;
  level_type: 'direct_manager' | 'org_admin' | 'accounting_manager' | 'specific_user';
  specific_user_id: string | null;
  is_required: boolean;
  can_skip_if_approved_amount_under: number | null;
  custom_message: string | null;
}

interface ApprovalChain {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  levels?: ApprovalChainLevel[];
}

interface GradeChainAssignment {
  id: string;
  organization_id: string;
  grade_id: string | null;
  chain_id: string;
  min_amount: number | null;
  max_amount: number | null;
}

interface EmployeeGrade {
  id: string;
  name: string;
  level: number;
}

interface ManagerUser {
  id: string;
  full_name: string;
  department: string;
}

interface UserProfile {
  id: string;
  organization_id: string | null;
}

const levelTypeLabels: Record<string, string> = {
  direct_manager: "מנהל ישיר",
  org_admin: "מנהל ארגון",
  accounting_manager: "הנהלת חשבונות",
  specific_user: "משתמש ספציפי",
};

const levelTypeIcons: Record<string, React.ReactNode> = {
  direct_manager: <Users className="h-4 w-4" />,
  org_admin: <Building className="h-4 w-4" />,
  accounting_manager: <Calculator className="h-4 w-4" />,
  specific_user: <User className="h-4 w-4" />,
};

// Level Item Component
const LevelItem = ({ 
  level, 
  onRemove, 
  onUpdate 
}: { 
  level: ApprovalChainLevel; 
  onRemove: () => void; 
  onUpdate: (updates: Partial<ApprovalChainLevel>) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [customMessage, setCustomMessage] = useState(level.custom_message || '');
  const [skipAmount, setSkipAmount] = useState(level.can_skip_if_approved_amount_under?.toString() || '');

  const handleSave = () => {
    onUpdate({
      custom_message: customMessage || null,
      can_skip_if_approved_amount_under: skipAmount ? parseFloat(skipAmount) : null
    });
    setIsEditing(false);
  };

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {level.level_order}
          </div>
          <div className="flex items-center gap-2">
            {levelTypeIcons[level.level_type]}
            <span className="text-sm">{levelTypeLabels[level.level_type]}</span>
          </div>
          {level.can_skip_if_approved_amount_under && (
            <Badge variant="outline" className="text-xs">
              דילוג מתחת ל-₪{level.can_skip_if_approved_amount_under.toLocaleString()}
            </Badge>
          )}
          {level.custom_message && (
            <Badge variant="secondary" className="text-xs">הודעה מותאמת</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isEditing && (
        <div className="pt-2 border-t space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">הודעה מותאמת לרמת האישור</Label>
            <Textarea
              placeholder="הזן הודעה שתוצג למאשר..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">דילוג אוטומטי מתחת לסכום (₪)</Label>
            <Input
              type="number"
              placeholder="ללא דילוג אוטומטי"
              value={skipAmount}
              onChange={(e) => setSkipAmount(e.target.value)}
              className="w-48"
            />
          </div>
          <Button size="sm" onClick={handleSave}>שמור</Button>
        </div>
      )}
    </div>
  );
};

export const ApprovalChainManager = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [grades, setGrades] = useState<EmployeeGrade[]>([]);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [assignments, setAssignments] = useState<GradeChainAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  
  // Dialog states
  const [isNewChainDialogOpen, setIsNewChainDialogOpen] = useState(false);
  const [isEditChainDialogOpen, setIsEditChainDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [editingChain, setEditingChain] = useState<ApprovalChain | null>(null);
  
  // Form states
  const [newChainName, setNewChainName] = useState("");
  const [newChainDescription, setNewChainDescription] = useState("");
  const [newChainIsDefault, setNewChainIsDefault] = useState(false);
  
  // Assignment form
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [selectedChainId, setSelectedChainId] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, organization_id")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile?.organization_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch chains with levels
      const { data: chainsData, error: chainsError } = await supabase
        .from("approval_chain_configs")
        .select("*")
        .eq("organization_id", profile?.organization_id)
        .order("created_at", { ascending: false });

      if (chainsError) throw chainsError;

      // Fetch levels for each chain
      if (chainsData && chainsData.length > 0) {
        const chainIds = chainsData.map(c => c.id);
        const { data: levelsData } = await supabase
          .from("approval_chain_levels")
          .select("*")
          .in("chain_id", chainIds)
          .order("level_order", { ascending: true });

        const chainsWithLevels = chainsData.map(chain => ({
          ...chain,
          levels: levelsData?.filter(l => l.chain_id === chain.id) || [],
        }));
        setChains(chainsWithLevels);
      } else {
        setChains([]);
      }

      // Fetch grades
      const { data: gradesData } = await supabase
        .from("employee_grades")
        .select("id, name, level")
        .eq("organization_id", profile?.organization_id)
        .eq("is_active", true)
        .order("level", { ascending: true });

      setGrades(gradesData || []);

      // Fetch managers
      const { data: managersData } = await supabase
        .from("profiles")
        .select("id, full_name, department")
        .eq("organization_id", profile?.organization_id)
        .eq("is_manager", true);

      setManagers(managersData || []);

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from("grade_chain_assignments")
        .select("*")
        .eq("organization_id", profile?.organization_id);

      setAssignments(assignmentsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  const createChain = async () => {
    if (!newChainName.trim()) {
      toast.error("יש להזין שם לשרשרת");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("approval_chain_configs")
        .insert({
          organization_id: profile?.organization_id,
          name: newChainName,
          description: newChainDescription || null,
          is_default: newChainIsDefault,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("שרשרת אישורים נוצרה בהצלחה");
      setIsNewChainDialogOpen(false);
      setNewChainName("");
      setNewChainDescription("");
      setNewChainIsDefault(false);
      fetchData();
      
      // Expand the new chain to add levels
      if (data) {
        setExpandedChain(data.id);
      }
    } catch (error) {
      console.error("Error creating chain:", error);
      toast.error("שגיאה ביצירת שרשרת");
    }
  };

  const updateChain = async () => {
    if (!editingChain) return;

    try {
      const { error } = await supabase
        .from("approval_chain_configs")
        .update({
          name: editingChain.name,
          description: editingChain.description,
          is_active: editingChain.is_active,
          is_default: editingChain.is_default,
        })
        .eq("id", editingChain.id);

      if (error) throw error;

      toast.success("שרשרת עודכנה בהצלחה");
      setIsEditChainDialogOpen(false);
      setEditingChain(null);
      fetchData();
    } catch (error) {
      console.error("Error updating chain:", error);
      toast.error("שגיאה בעדכון שרשרת");
    }
  };

  const deleteChain = async (chainId: string) => {
    try {
      const { error } = await supabase
        .from("approval_chain_configs")
        .delete()
        .eq("id", chainId);

      if (error) throw error;

      toast.success("שרשרת נמחקה בהצלחה");
      fetchData();
    } catch (error) {
      console.error("Error deleting chain:", error);
      toast.error("שגיאה במחיקת שרשרת");
    }
  };

  const addLevelToChain = async (chainId: string, levelType: string) => {
    const chain = chains.find(c => c.id === chainId);
    const nextOrder = (chain?.levels?.length || 0) + 1;

    try {
      const { error } = await supabase
        .from("approval_chain_levels")
        .insert({
          chain_id: chainId,
          level_order: nextOrder,
          level_type: levelType as any,
          is_required: true,
        });

      if (error) throw error;

      toast.success("רמת אישור נוספה");
      fetchData();
    } catch (error) {
      console.error("Error adding level:", error);
      toast.error("שגיאה בהוספת רמת אישור");
    }
  };

  const removeLevelFromChain = async (levelId: string) => {
    try {
      const { error } = await supabase
        .from("approval_chain_levels")
        .delete()
        .eq("id", levelId);

      if (error) throw error;

      toast.success("רמת אישור הוסרה");
      fetchData();
    } catch (error) {
      console.error("Error removing level:", error);
      toast.error("שגיאה בהסרת רמת אישור");
    }
  };

  const updateLevel = async (levelId: string, updates: Partial<ApprovalChainLevel>) => {
    try {
      const { error } = await supabase
        .from("approval_chain_levels")
        .update({
          custom_message: updates.custom_message,
          can_skip_if_approved_amount_under: updates.can_skip_if_approved_amount_under
        })
        .eq("id", levelId);

      if (error) throw error;

      toast.success("רמת אישור עודכנה");
      fetchData();
    } catch (error) {
      console.error("Error updating level:", error);
      toast.error("שגיאה בעדכון רמת אישור");
    }
  };

  const createAssignment = async () => {
    if (!selectedChainId) {
      toast.error("יש לבחור שרשרת אישורים");
      return;
    }

    try {
      const { error } = await supabase
        .from("grade_chain_assignments")
        .insert({
          organization_id: profile?.organization_id,
          grade_id: selectedGradeId || null,
          chain_id: selectedChainId,
          min_amount: minAmount ? parseFloat(minAmount) : null,
          max_amount: maxAmount ? parseFloat(maxAmount) : null,
        });

      if (error) throw error;

      toast.success("שיוך נוצר בהצלחה");
      setIsAssignmentDialogOpen(false);
      setSelectedGradeId("");
      setSelectedChainId("");
      setMinAmount("");
      setMaxAmount("");
      fetchData();
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error("שגיאה ביצירת שיוך");
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("grade_chain_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("שיוך נמחק");
      fetchData();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("שגיאה במחיקת שיוך");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">שרשראות אישורים</h3>
          <p className="text-sm text-muted-foreground">הגדר מי מאשר בקשות נסיעה ובאיזה סדר</p>
        </div>
        <Dialog open={isNewChainDialogOpen} onOpenChange={setIsNewChainDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              שרשרת חדשה
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>יצירת שרשרת אישורים חדשה</DialogTitle>
              <DialogDescription>הגדר שרשרת אישורים עם שם ותיאור</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="chainName">שם השרשרת</Label>
                <Input
                  id="chainName"
                  value={newChainName}
                  onChange={(e) => setNewChainName(e.target.value)}
                  placeholder="לדוגמה: שרשרת סטנדרטית"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chainDescription">תיאור</Label>
                <Textarea
                  id="chainDescription"
                  value={newChainDescription}
                  onChange={(e) => setNewChainDescription(e.target.value)}
                  placeholder="תיאור השרשרת..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isDefault"
                  checked={newChainIsDefault}
                  onCheckedChange={setNewChainIsDefault}
                />
                <Label htmlFor="isDefault">שרשרת ברירת מחדל</Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">ביטול</Button>
              </DialogClose>
              <Button onClick={createChain}>יצירה</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chains List */}
      {chains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              אין שרשראות אישורים מוגדרות.
              <br />
              צור שרשרת ראשונה כדי להתחיל.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {chains.map((chain) => (
            <Card key={chain.id} className={cn(!chain.is_active && "opacity-60")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedChain(expandedChain === chain.id ? null : chain.id)}
                    >
                      {expandedChain === chain.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {chain.name}
                        {chain.is_default && (
                          <Badge variant="secondary" className="text-xs">ברירת מחדל</Badge>
                        )}
                        {!chain.is_active && (
                          <Badge variant="outline" className="text-xs">לא פעיל</Badge>
                        )}
                      </CardTitle>
                      {chain.description && (
                        <CardDescription className="text-xs mt-1">{chain.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingChain(chain);
                        setIsEditChainDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>מחיקת שרשרת אישורים</AlertDialogTitle>
                          <AlertDialogDescription>
                            האם למחוק את "{chain.name}"? פעולה זו לא ניתנת לביטול.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteChain(chain.id)}>מחיקה</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Preview levels inline */}
                {chain.levels && chain.levels.length > 0 && expandedChain !== chain.id && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {chain.levels.map((level, index) => (
                      <div key={level.id} className="flex items-center gap-1">
                        <Badge variant="outline" className="gap-1">
                          {levelTypeIcons[level.level_type]}
                          {levelTypeLabels[level.level_type]}
                        </Badge>
                        {index < chain.levels!.length - 1 && (
                          <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardHeader>

              {expandedChain === chain.id && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">רמות אישור</h4>
                      <Select onValueChange={(value) => addLevelToChain(chain.id, value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="הוסף רמת אישור" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct_manager">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              מנהל ישיר
                            </div>
                          </SelectItem>
                          <SelectItem value="org_admin">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              מנהל ארגון
                            </div>
                          </SelectItem>
                          <SelectItem value="accounting_manager">
                            <div className="flex items-center gap-2">
                              <Calculator className="h-4 w-4" />
                              הנהלת חשבונות
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {chain.levels && chain.levels.length > 0 ? (
                      <div className="space-y-3">
                        {chain.levels.map((level, index) => (
                          <LevelItem
                            key={level.id}
                            level={level}
                            onRemove={() => removeLevelFromChain(level.id)}
                            onUpdate={(updates) => updateLevel(level.id, updates)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        אין רמות אישור מוגדרות. הוסף רמות כדי לבנות את השרשרת.
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Grade Assignments Section */}
      <div className="pt-6 border-t">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">שיוך לדרגות</h3>
            <p className="text-sm text-muted-foreground">הגדר איזו שרשרת חלה על כל דרגה וטווח סכומים</p>
          </div>
          <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={chains.length === 0}>
                <Plus className="h-4 w-4 ml-2" />
                שיוך חדש
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>שיוך שרשרת לדרגה</DialogTitle>
                <DialogDescription>הגדר איזו שרשרת תחול על דרגה מסוימת וטווח סכומים</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>דרגה</Label>
                  <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר דרגה (ריק = כל הדרגות)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">כל הדרגות</SelectItem>
                      {grades.map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שרשרת אישורים</Label>
                  <Select value={selectedChainId} onValueChange={setSelectedChainId}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר שרשרת" />
                    </SelectTrigger>
                    <SelectContent>
                      {chains.filter(c => c.is_active).map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minAmount">סכום מינימלי (₪)</Label>
                    <Input
                      id="minAmount"
                      type="number"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      placeholder="ללא מינימום"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAmount">סכום מקסימלי (₪)</Label>
                    <Input
                      id="maxAmount"
                      type="number"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      placeholder="ללא מקסימום"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">ביטול</Button>
                </DialogClose>
                <Button onClick={createAssignment}>יצירה</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              אין שיוכים מוגדרים. צור שיוך כדי לקשר שרשראות לדרגות.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assignments.map((assignment) => {
              const grade = grades.find(g => g.id === assignment.grade_id);
              const chain = chains.find(c => c.id === assignment.chain_id);
              
              return (
                <Card key={assignment.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">
                        {grade ? grade.name : "כל הדרגות"}
                      </Badge>
                      <ArrowDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                      <span className="font-medium">{chain?.name || "שרשרת לא נמצאה"}</span>
                      {(assignment.min_amount || assignment.max_amount) && (
                        <span className="text-sm text-muted-foreground">
                          ({assignment.min_amount ? `מ-₪${assignment.min_amount.toLocaleString()}` : ""}
                          {assignment.min_amount && assignment.max_amount ? " - " : ""}
                          {assignment.max_amount ? `עד ₪${assignment.max_amount.toLocaleString()}` : ""})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteAssignment(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Chain Dialog */}
      <Dialog open={isEditChainDialogOpen} onOpenChange={setIsEditChainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת שרשרת אישורים</DialogTitle>
          </DialogHeader>
          {editingChain && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editChainName">שם השרשרת</Label>
                <Input
                  id="editChainName"
                  value={editingChain.name}
                  onChange={(e) => setEditingChain({ ...editingChain, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editChainDescription">תיאור</Label>
                <Textarea
                  id="editChainDescription"
                  value={editingChain.description || ""}
                  onChange={(e) => setEditingChain({ ...editingChain, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="editIsActive"
                    checked={editingChain.is_active}
                    onCheckedChange={(checked) => setEditingChain({ ...editingChain, is_active: checked })}
                  />
                  <Label htmlFor="editIsActive">פעיל</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="editIsDefault"
                    checked={editingChain.is_default}
                    onCheckedChange={(checked) => setEditingChain({ ...editingChain, is_default: checked })}
                  />
                  <Label htmlFor="editIsDefault">ברירת מחדל</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">ביטול</Button>
            </DialogClose>
            <Button onClick={updateChain}>שמירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
