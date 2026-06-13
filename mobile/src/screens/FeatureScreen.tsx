import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ScrollView, Vibration, Alert, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Switch, Share, Linking, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { db } from '../lib/firebase';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, 
  orderBy, limit, getDocs, getDoc, setDoc
} from 'firebase/firestore';
import { 
  Plus, Play, Search, Calculator, CreditCard, History, Package, Home, PlusCircle, 
  Tag, BadgePercent, Layers, CalendarRange, FileText, TrendingUp, Flame, Coins, 
  Users, Lock, Clock, UserCheck, ClipboardList, AlertTriangle, ShieldCheck, 
  CheckCircle, ArrowUpRight, ArrowDownLeft, X, Edit2, Trash2, Check, CheckSquare, Square,
  ArrowRightLeft, ChevronRight, Circle, ArrowDownCircle, ArrowUpCircle, RefreshCw, ShoppingBag, Activity, ListFilter,
  Printer, UserCog, Download
} from 'lucide-react-native';
import { printReceipt, printA4 } from '../utils/ReceiptHelper';
import SwipeableItem from '../components/SwipeableItem';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function FeatureScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { featureId, title } = route.params;
  const { storeId, user, role, isSubscriptionExpired, subscriptionUntil } = useAuthStore();

  const [search, setSearch] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- FORM STATES ---
  const [formName, setFormName] = useState('');
  const [formBaseCost, setFormBaseCost] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCustomer, setFormCustomer] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [formCapacity, setFormCapacity] = useState('50%');
  const [formItemsCount, setFormItemsCount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formVal, setFormVal] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formOrders, setFormOrders] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formType, setFormType] = useState('in'); // 'in' or 'out'
  const [formActual, setFormActual] = useState('');
  const [formExpected, setFormExpected] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [maxUsers, setMaxUsers] = useState(5);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [editPermissions, setEditPermissions] = useState({
    canAccessPOS: true,
    canManageProducts: false,
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewReports: false,
    canManageUsers: false,
    canEditSettings: false,
    canManageEstimations: false,
    canManageDebts: false,
    canManageOrders: false,
    canViewLogs: false
  });

  // --- EDIT & EXTRA GROUP FORM STATES ---
  const [editId, setEditId] = useState<string | null>(null);
  const [formOptions, setFormOptions] = useState<{ name: string, price: string }[]>([{ name: '', price: '0' }]);
  const [formIsMandatory, setFormIsMandatory] = useState(false);
  const [formAllowMultiple, setFormAllowMultiple] = useState(false);
  const [formHasMaxLimit, setFormHasMaxLimit] = useState(false);
  const [formMaxLimit, setFormMaxLimit] = useState('1');
  const [formIsActive, setFormIsActive] = useState(true);

  // --- SYNCED PRODUCT MANAGEMENT STATES ---
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isAdjustModalVisible, setIsAdjustModalVisible] = useState(false);
  const [mutationType, setMutationType] = useState<'masuk' | 'keluar' | 'penyesuaian'>('masuk');
  const [mutationQty, setMutationQty] = useState('');
  const [mutationNote, setMutationNote] = useState('');
  const [isSavingStock, setIsSavingStock] = useState(false);

  // Expired Menu Tab State
  const [expiredTab, setExpiredTab] = useState<'expired' | 'near' | 'safe'>('near');

  // Discount Menu Modal Target Selection States
  const [isSelectorModalVisible, setIsSelectorModalVisible] = useState(false);
  const [tempSelectedProductIds, setTempSelectedProductIds] = useState<string[]>([]);
  const [selectorTab, setSelectorTab] = useState<'product' | 'category'>('product');
  const [selectorSearch, setSelectorSearch] = useState('');

  // Form states matching web Discount
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [discountStartDate, setDiscountStartDate] = useState('');
  const [discountEndDate, setDiscountEndDate] = useState('');
  const [discountIsActive, setDiscountIsActive] = useState(true);

  // --- SYNCED FINANCE AND TRANSACTION STATES ---
  // Arus Kas States
  const [cashFlowTab, setCashFlowTab] = useState<'all' | 'income' | 'expense'>('all');
  const [cashFlowDateRange, setCashFlowDateRange] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [cashFlowCustomStartDate, setCashFlowCustomStartDate] = useState('');
  const [cashFlowCustomEndDate, setCashFlowCustomEndDate] = useState('');
  const [isCashFlowProcessing, setIsCashFlowProcessing] = useState(false);

  // Piutang States
  const [debtFilter, setDebtFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [selectedDebt, setSelectedDebt] = useState<any | null>(null);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');
  const [debtPaymentNote, setDebtPaymentNote] = useState('Pembayaran cicilan mobile');
  const [isSubmittingDebtPayment, setIsSubmittingDebtPayment] = useState(false);
  const [editingDebtNoteId, setEditingDebtNoteId] = useState<string | null>(null);
  const [editDebtNoteValue, setEditDebtNoteValue] = useState('');

  // Item Editing States
  const [editingDebtItemIndex, setEditingDebtItemIndex] = useState<number | null>(null);
  const [editDebtItemData, setEditDebtItemData] = useState({qty: '1', price: '0', note: ''});

  // Estimasi States
  const [estimationFilter, setEstimationFilter] = useState<'active' | 'converted' | 'cancelled'>('active');

  // Shift Management States (Specific to case 'shift')
  const [activeShiftStats, setActiveShiftStats] = useState({
    cashSales: 0,
    nonCashSales: 0,
    trxCount: 0
  });
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [startingCash, setStartingCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [isShiftProcessing, setIsShiftProcessing] = useState(false);
  const [shiftTab, setShiftTab] = useState<'active' | 'history'>('active');

  // Reset startingCash States
  const [isResetShiftModalOpen, setIsResetShiftModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingShift, setIsResettingShift] = useState(false);

  // --- DATA STATES ---
  const [estimations, setEstimations] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [rawSoldTransactions, setRawSoldTransactions] = useState<any[]>([]);
  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [expiredItems, setExpiredItems] = useState<any[]>([]);
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [closingLogs, setClosingLogs] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Sold Items (Terjual) States
  const [salesAnalyticsClearedAt, setSalesAnalyticsClearedAt] = useState<Date | null>(null);
  const [soldMonthFilter, setSoldMonthFilter] = useState<string>(new Date().getMonth().toString());
  const [soldYearFilter, setSoldYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [isResettingSold, setIsResettingSold] = useState(false);

  // Laporan Penjualan State
  const [salesTransactions, setSalesTransactions] = useState<any[]>([]);
  const [reportsPenjualanState, setReportsPenjualanState] = useState({
    grossSales: 0,
    totalOrders: 0,
    avgBasket: 0,
    discountGiven: 0,
    paymentMethods: {} as Record<string, number>
  });

  const [salesDateRange, setSalesDateRange] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [salesCustomStartDate, setSalesCustomStartDate] = useState('');
  const [salesCustomEndDate, setSalesCustomEndDate] = useState('');

  // Laporan Omzet State
  const [omzetReportState, setOmzetReportState] = useState<any[]>([]);
  const [omzetTransactions, setOmzetTransactions] = useState<any[]>([]);
  const [omzetPeriodType, setOmzetPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [omzetYearFilter, setOmzetYearFilter] = useState<string>('Semua');

  // --- FIRESTORE SUBSCRIPTIONS ---
  useEffect(() => {
    if (!storeId) return;

    setLoading(true);
    let q;
    let unsubscribe = () => {};

    try {
      switch (featureId) {
        case 'estimasi':
          q = query(collection(db, 'estimations'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              docs.push({ id: doc.id, ...doc.data() });
            });
            // Client side sort by timestamp DESC (like web app)
            docs.sort((a, b) => {
              const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
              const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
              return timeB - timeA;
            });
            setEstimations(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading estimations:", err);
            setLoading(false);
          });
          break;

        case 'piutang':
          q = query(collection(db, 'transactions'), where('storeId', '==', storeId), where('paymentCategory', '==', 'debt'));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.paymentStatus !== 'cancelled' && data.orderStatus !== 'cancelled') {
                docs.push({ id: doc.id, ...data });
              }
            });
            // Client side sort by timestamp DESC (like web app)
            docs.sort((a, b) => {
              const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
              const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
              return timeB - timeA;
            });
            setDebts(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading debts:", err);
            setLoading(false);
          });
          break;

        case 'gudang':
          q = query(collection(db, 'products'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              docs.push({ id: doc.id, ...doc.data() });
            });
            const managedProds = docs.filter(p => p.manageStock !== false);
            setWarehouses(managedProds);
            setLoading(false);
          }, (err) => {
            console.error("Error loading gudang products:", err);
            setLoading(false);
          });
          break;

        case 'ekstra':
          q = query(collection(db, 'product_extras'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              docs.push({ id: doc.id, ...doc.data() });
            });
            setExtras(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading extras:", err);
            setLoading(false);
          });
          break;

        case 'diskon': {
          q = query(collection(db, 'discounts'), where('storeId', '==', storeId));
          const unsubDisc = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              docs.push({ id: doc.id, ...doc.data() });
            });
            setDiscounts(docs);
          }, (err) => {
            console.error("Error loading discounts:", err);
          });

          const qProds = query(collection(db, 'products'), where('storeId', '==', storeId));
          const unsubProds = onSnapshot(qProds, (snapshot) => {
            const prods: any[] = [];
            const cats = new Set<string>();
            snapshot.forEach((doc) => {
              const data = doc.data();
              prods.push({ id: doc.id, ...data });
              if (data.category) cats.add(data.category);
            });
            setAllProducts(prods);
            setAllCategories(Array.from(cats).sort());
            setLoading(false);
          }, (err) => {
            console.error("Error loading products for discounts:", err);
            setLoading(false);
          });

          unsubscribe = () => {
            unsubDisc();
            unsubProds();
          };
          break;
        }

        case 'terjual':
        case 'lap_terlaris':
          // Fetch settings for clearedAt
          getDoc(doc(db, 'settings', `store_${storeId}`)).then(docSnap => {
            if (docSnap.exists() && docSnap.data().salesAnalyticsClearedAt) {
              setSalesAnalyticsClearedAt(docSnap.data().salesAnalyticsClearedAt.toDate());
            }
          });

          q = query(collection(db, 'transactions'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const allTrx: any[] = [];
            snapshot.forEach((doc) => {
              allTrx.push(doc.data());
            });
            setRawSoldTransactions(allTrx);
            setLoading(false);
          }, (err) => {
            console.error("Error loading transactions for sold items:", err);
            setLoading(false);
          });
          break;

        case 'stok':
          q = query(collection(db, 'stock_history'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              docs.push({ id: doc.id, ...data });
            });
            const getMs = (ts: any) => {
              if (!ts) return 0;
              if (ts.toMillis) return ts.toMillis();
              if (ts.toDate) return ts.toDate().getTime();
              return new Date(ts).getTime();
            };
            docs.sort((a, b) => getMs(b.timestamp) - getMs(a.timestamp));
            setStockLogs(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading stock mutations:", err);
            setLoading(false);
          });
          break;

        case 'expired':
          q = query(collection(db, 'products'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.expiryDate && (data.stock || 0) > 0) {
                const diffTime = new Date(data.expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                docs.push({
                  id: doc.id,
                  name: data.name,
                  qty: data.stock,
                  daysLeft: diffDays,
                  date: data.expiryDate,
                  purchasePrice: data.purchasePrice || 0,
                  sku: data.sku || '',
                  entryDate: data.entryDate || null
                });
              }
            });
            docs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setExpiredItems(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading expiry dates:", err);
            setLoading(false);
          });
          break;

        case 'lap_penjualan': {
          const qProds = query(collection(db, 'products'), where('storeId', '==', storeId));
          const unsubProds = onSnapshot(qProds, (prodSnapshot) => {
            const prods: any[] = [];
            prodSnapshot.forEach(d => prods.push({ id: d.id, ...d.data() }));
            setAllProducts(prods);
          });

          q = query(collection(db, 'transactions'), where('storeId', '==', storeId));
          const unsubTrx = onSnapshot(q, (snapshot) => {
            const allTrx: any[] = [];
            snapshot.forEach((doc) => {
              allTrx.push({ id: doc.id, ...doc.data() });
            });
            setSalesTransactions(allTrx);
            setLoading(false);
          }, (err) => {
            console.error("Error loading sales stats:", err);
            setLoading(false);
          });

          unsubscribe = () => {
            unsubProds();
            unsubTrx();
          };
          break;
        }

        case 'lap_omzet':
          q = query(collection(db, 'transactions'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const items: any[] = [];
            snapshot.forEach((doc) => {
              items.push({ id: doc.id, ...doc.data() });
            });
            setOmzetTransactions(items);
            setLoading(false);
          }, (err) => {
            console.error("Error loading omzet report:", err);
            setLoading(false);
          });
          break;

        case 'arus_kas': {
          let currentCF: any[] = [];
          let currentTrx: any[] = [];
          
          const updateCombined = () => {
            const combined = [...currentCF, ...currentTrx];
            setCashflows(combined);
            setLoading(false);
          };

          const unsubCF = onSnapshot(
            query(collection(db, 'cash_flow'), where('storeId', '==', storeId)),
            (snapCF) => {
              const flowDocs: any[] = [];
              snapCF.forEach((doc) => {
                const data = doc.data();
                flowDocs.push({
                  id: doc.id,
                  description: data.description || '',
                  amount: data.amount || 0,
                  type: data.type || 'out',
                  category: data.category || 'operasional',
                  timestamp: data.timestamp,
                  userEmail: data.userEmail || 'admin',
                  isManual: true
                });
              });
              currentCF = flowDocs;
              updateCombined();
            }, (err) => {
              console.error("Error loading cash flow:", err);
              setLoading(false);
            }
          );

          const unsubTrx = onSnapshot(
            query(collection(db, 'transactions'), where('storeId', '==', storeId)),
            (snapTrx) => {
              const trxInflow: any[] = [];
              snapTrx.forEach((doc) => {
                const data = doc.data();
                if (data.paymentStatus === 'paid') {
                  trxInflow.push({
                    id: doc.id,
                    description: `Penjualan POS #${doc.id.substring(0, 6)}`,
                    amount: data.total || 0,
                    type: 'in',
                    category: 'penjualan',
                    paymentMethod: data.paymentMethod || 'cash',
                    timestamp: data.timestamp,
                    userEmail: data.cashierName || 'System',
                    isManual: false
                  });
                }
              });
              currentTrx = trxInflow;
              updateCombined();
            }, (err) => {
              console.error("Error loading trx for cash flow:", err);
              setLoading(false);
            }
          );

          unsubscribe = () => { unsubCF(); unsubTrx(); };
          break;
        }

        case 'pelanggan':
          q = query(collection(db, 'customers'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              docs.push({ id: doc.id, ...doc.data() });
            });
            setCustomers(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading customers:", err);
            setLoading(false);
          });
          break;

        case 'tutup_buku':
          q = query(collection(db, 'cashier_sessions'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.closedAt || data.timestamp) {
                docs.push({ id: doc.id, ...data });
              }
            });
            // Sort by timestamp or closedAt desc
            docs.sort((a, b) => {
              const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.closedAt ? new Date(a.closedAt).getTime() : 0);
              const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.closedAt ? new Date(b.closedAt).getTime() : 0);
              return timeB - timeA;
            });
            setClosingLogs(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading closing sessions:", err);
            setLoading(false);
          });
          break;

        case 'shift':
          q = query(collection(db, 'shifts'), where('storeId', '==', storeId));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.staffName === undefined) {
                docs.push({ id: docSnap.id, ...data });
              }
            });
            docs.sort((a, b) => {
              if (a.status === 'open' && b.status === 'closed') return -1;
              if (a.status === 'closed' && b.status === 'open') return 1;
              const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
              const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
              return timeB - timeA;
            });
            setShifts(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading shifts:", err);
            setLoading(false);
          });
          break;

        case 'staff':
          const storeRef = doc(db, 'stores', storeId);
          const unsubStore = onSnapshot(storeRef, (docSnap) => {
            if (docSnap.exists()) {
              setMaxUsers(docSnap.data().maxUsers || 5);
            }
          });
          q = query(collection(db, 'users'), where('storeId', '==', storeId));
          const unsubUsers = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data.role !== 'super-admin') {
                docs.push({ id: docSnap.id, ...data });
              }
            });
            setStaffs(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading staffs:", err);
            setLoading(false);
          });
          unsubscribe = () => {
            unsubStore();
            unsubUsers();
          };
          break;

        case 'activity_log':
          q = query(collection(db, 'activity_logs'), where('storeId', '==', storeId), limit(100));
          unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              const dateVal = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : new Date(data.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })) : 'Baru saja';
              docs.push({
                id: doc.id,
                user: data.userName || 'System',
                desc: data.description,
                time: dateVal
              });
            });
            setActivities(docs);
            setLoading(false);
          }, (err) => {
            console.error("Error loading logs:", err);
            setLoading(false);
          });
          break;
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [storeId, featureId]);

  const omzetAvailableYears = useMemo(() => {
    const years = new Set<string>();
    omzetTransactions.forEach(t => {
      if (!t.timestamp) return;
      const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
      years.add(String(date.getFullYear()));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [omzetTransactions]);

  useEffect(() => {
    if (featureId !== 'lap_omzet') return;
    
    let filtered = omzetTransactions.filter(t => t.paymentStatus === 'paid' && t.timestamp);

    if (omzetPeriodType === 'weekly') {
      const now = new Date();
      const weeksData = [
        { label: 'Minggu 4 (Terkini)', amount: 0, rangeStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { label: 'Minggu 3', amount: 0, rangeStart: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), rangeEnd: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { label: 'Minggu 2', amount: 0, rangeStart: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000), rangeEnd: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
        { label: 'Minggu 1', amount: 0, rangeStart: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), rangeEnd: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000) },
      ];

      filtered.forEach(t => {
        const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        for (const wk of weeksData) {
          if (date >= wk.rangeStart && (!('rangeEnd' in wk) || date < (wk as any).rangeEnd)) {
            wk.amount += (t.total || 0);
            break;
          }
        }
      });

      const maxAmount = Math.max(...weeksData.map(w => w.amount), 1);
      setOmzetReportState(weeksData.map((wk, idx) => ({
        label: wk.label,
        amount: wk.amount,
        pct: Math.round((wk.amount / maxAmount) * 100),
        active: idx === 0
      })));
    } else if (omzetPeriodType === 'monthly') {
      if (omzetYearFilter !== 'Semua') {
        filtered = filtered.filter(t => {
          const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
          return String(date.getFullYear()) === omzetYearFilter;
        });
      }

      const stats: Record<string, { total: number; label: string; sortKey: string }> = {};
      filtered.forEach(t => {
        const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        const label = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!stats[sortKey]) {
          stats[sortKey] = { total: 0, label, sortKey };
        }
        stats[sortKey].total += (t.total || 0);
      });

      const list = Object.values(stats).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
      const maxAmount = Math.max(...list.map(w => w.total), 1);
      setOmzetReportState(list.map((item, idx) => ({
        label: item.label,
        amount: item.total,
        pct: Math.round((item.total / maxAmount) * 100),
        active: idx === 0
      })));
    } else if (omzetPeriodType === 'yearly') {
      const stats: Record<string, { total: number; label: string; sortKey: string }> = {};
      filtered.forEach(t => {
        const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        const year = String(date.getFullYear());
        const label = `Tahun ${year}`;
        const sortKey = year;
        
        if (!stats[sortKey]) {
          stats[sortKey] = { total: 0, label, sortKey };
        }
        stats[sortKey].total += (t.total || 0);
      });

      const list = Object.values(stats).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
      const maxAmount = Math.max(...list.map(w => w.total), 1);
      setOmzetReportState(list.map((item, idx) => ({
        label: item.label,
        amount: item.total,
        pct: Math.round((item.total / maxAmount) * 100),
        active: idx === 0
      })));
    }
  }, [omzetTransactions, omzetPeriodType, omzetYearFilter, featureId]);

  const myActiveShift = useMemo(() => {
    return shifts.find(s => s.status === 'open' && s.userId === user?.uid);
  }, [shifts, user]);

  useEffect(() => {
    if (featureId !== 'shift' || !myActiveShift || !storeId) {
      setActiveShiftStats({ cashSales: 0, nonCashSales: 0, trxCount: 0 });
      return;
    }

    const qTrx = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('cashierId', '==', myActiveShift.userId),
      where('timestamp', '>=', myActiveShift.startTime)
    );

    const unsubscribeTrxStats = onSnapshot(qTrx, (snap) => {
      let cash = 0;
      let nonCash = 0;
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.paymentStatus === 'paid') {
          if (d.paymentMethod === 'cash') cash += d.total;
          else nonCash += d.total;
        }
      });
      setActiveShiftStats({
        cashSales: cash,
        nonCashSales: nonCash,
        trxCount: snap.size
      });
    }, (err) => {
      console.log("Error loading active stats in FeatureScreen:", err);
    });

    return () => unsubscribeTrxStats();
  }, [myActiveShift, storeId, featureId]);

  // Derived Sales Summary Memo
  const salesSummary = useMemo(() => {
    const itemsMap: Record<string, { id: string, name: string, qty: number, sales: number }> = {};
    let index = 0;

    rawSoldTransactions.forEach(trx => {
      if (trx.paymentStatus === 'cancelled' || trx.orderStatus === 'cancelled') return;

      const trxDate = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
      
      if (salesAnalyticsClearedAt && trxDate < salesAnalyticsClearedAt) return;

      if (soldMonthFilter !== 'all') {
        if (trxDate.getMonth() !== parseInt(soldMonthFilter) || trxDate.getFullYear() !== parseInt(soldYearFilter)) return;
      } else {
        if (trxDate.getFullYear() !== parseInt(soldYearFilter)) return;
      }

      trx.items?.forEach((item: any) => {
        const prodId = item.productId || item.productName;
        if (!itemsMap[prodId]) {
          index++;
          itemsMap[prodId] = { id: String(index), name: item.productName, qty: 0, sales: 0 };
        }
        itemsMap[prodId].qty += item.qty;
        itemsMap[prodId].sales += (item.qty * item.price);
      });
    });

    return Object.values(itemsMap).sort((a, b) => b.qty - a.qty);
  }, [rawSoldTransactions, salesAnalyticsClearedAt, soldMonthFilter, soldYearFilter]);

  // Export Excel/CSV logic
  const handleExportExcelCSV = async () => {
    let fileName = '';
    let headers: string[] = [];
    let rows: any[][] = [];

    switch (featureId) {
      case 'lap_penjualan':
        fileName = 'Laporan_Penjualan';
        headers = ['ID Transaksi', 'Waktu', 'Kasir', 'Pelanggan', 'Metode', 'Status', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'Piutang Awal', 'Piutang Terbayar', 'Sisa Piutang'];
        
        // Apply period filter first
        const now = new Date();
        let startDate: Date | null = null;
        if (salesDateRange === 'today') {
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
        } else if (salesDateRange === '7days') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
        } else if (salesDateRange === '30days') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 30);
          startDate.setHours(0, 0, 0, 0);
        } else if (salesDateRange === 'custom') {
          if (salesCustomStartDate) {
            startDate = new Date(salesCustomStartDate);
            startDate.setHours(0, 0, 0, 0);
          }
        }

        let filteredExportTrx = [...salesTransactions];
        if (startDate) {
          filteredExportTrx = filteredExportTrx.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date());
            return itemDate >= startDate!;
          });
        }
        if (salesDateRange === 'custom' && salesCustomEndDate) {
          const endDate = new Date(salesCustomEndDate);
          endDate.setHours(23, 59, 59, 999);
          filteredExportTrx = filteredExportTrx.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date());
            return itemDate <= endDate;
          });
        }

        rows = filteredExportTrx.map(t => {
          const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
          const isDebt = t.paymentCategory === 'debt';
          const dp = (isDebt && t.paymentHistory && t.paymentHistory.length > 0 && t.paymentHistory[0].note?.includes('DP')) 
            ? (t.paymentHistory[0].amount || 0) 
            : 0;
          
          const piutangAwal = isDebt ? Math.max(0, (t.total || 0) - dp) : 0;
          const paid = t.paidAmount || 0;
          const piutangTerbayar = isDebt ? Math.max(0, paid - dp) : 0;
          const sisaPiutang = isDebt ? (t.debtAmount !== undefined ? t.debtAmount : Math.max(0, (t.total || 0) - paid)) : 0;

          let statusStr = 'Lunas';
          if (t.paymentStatus === 'unpaid') statusStr = 'Belum Lunas';
          else if (t.paymentStatus === 'partially_paid') statusStr = 'Dicicil';
          else if (t.paymentStatus === 'pending') statusStr = 'Pending';
          else if (t.paymentStatus === 'cancelled') statusStr = 'Batal';

          return [
            t.id,
            date.toLocaleString('id-ID'),
            t.cashierName || 'Kasir',
            t.customerName || 'Umum',
            t.paymentMethod || t.paymentCategory || 'Cash',
            statusStr,
            t.subtotal || 0,
            t.discount || 0,
            t.tax || 0,
            t.total || 0,
            piutangAwal,
            piutangTerbayar,
            sisaPiutang
          ];
        });
        break;

      case 'lap_omzet':
        fileName = `Laporan_Omzet_${omzetPeriodType}`;
        headers = ['Periode', 'Total Omzet (Rp)'];
        rows = omzetReportState.map(item => [
          item.label,
          item.amount
        ]);
        break;

      case 'lap_terlaris':
        fileName = 'Laporan_Produk_Terlaris';
        headers = ['Nama Produk', 'Jumlah Terjual (QTY)', 'Total Pendapatan (Rp)'];
        const bestSellerMap: Record<string, { qty: number, revenue: number }> = {};
        rawSoldTransactions.forEach(t => {
          if (t.paymentStatus === 'cancelled' || t.orderStatus === 'cancelled') return;
          const trxDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
          if (salesAnalyticsClearedAt && trxDate < salesAnalyticsClearedAt) return;

          if (soldMonthFilter !== 'all') {
            if (trxDate.getMonth() !== parseInt(soldMonthFilter) || trxDate.getFullYear() !== parseInt(soldYearFilter)) return;
          } else {
            if (trxDate.getFullYear() !== parseInt(soldYearFilter)) return;
          }

          t.items?.forEach((item: any) => {
            const name = item.productName || 'Unknown';
            const qty = item.qty || 0;
            const subtotal = item.qty * item.price;
            if (!bestSellerMap[name]) {
              bestSellerMap[name] = { qty: 0, revenue: 0 };
            }
            bestSellerMap[name].qty += qty;
            bestSellerMap[name].revenue += subtotal;
          });
        });
        rows = Object.keys(bestSellerMap)
          .map(name => [name, bestSellerMap[name].qty, bestSellerMap[name].revenue])
          .sort((a: any, b: any) => b[1] - a[1]);
        break;

      case 'arus_kas':
        fileName = 'Laporan_Arus_Kas';
        headers = ['Waktu', 'Tipe', 'Kategori', 'Nominal (Rp)', 'Keterangan', 'Oleh'];
        rows = cashflows.map(item => {
          const date = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
          return [
            date.toLocaleString('id-ID'),
            item.type === 'in' ? 'Pemasukan' : 'Pengeluaran',
            item.category || '-',
            item.amount || 0,
            item.description || '',
            item.userEmail || '-'
          ];
        });
        break;

      case 'stok':
        fileName = 'Laporan_Mutasi_Stok';
        headers = ['Waktu', 'Produk', 'Pengguna', 'Jenis', 'QTY', 'Catatan'];
        rows = stockLogs.map(log => {
          const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
          return [
            date.toLocaleString('id-ID'),
            log.productName || '-',
            log.userEmail || '-',
            log.type || '-',
            log.qty || 0,
            log.note || '-'
          ];
        });
        break;

      case 'piutang':
        fileName = 'Laporan_Hutang_Piutang';
        headers = ['ID Transaksi', 'Pelanggan', 'Tanggal', 'Total Transaksi', 'Telah Dibayar', 'Sisa Piutang', 'Jatuh Tempo', 'Status'];
        rows = debts.map(d => {
          const date = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
          const currentPaid = d.paidAmount ?? d.cashReceived ?? 0;
          const remaining = d.total - currentPaid;
          return [
            d.id,
            d.customerName || 'Anonim',
            date.toLocaleString('id-ID'),
            d.total || 0,
            currentPaid,
            remaining,
            d.dueDate ? new Date(d.dueDate).toLocaleDateString('id-ID') : '-',
            d.paymentStatus || 'unpaid'
          ];
        });
        break;

      default:
        return;
    }

    if (rows.length === 0) {
      Alert.alert('Info', 'Tidak ada data untuk diekspor.');
      return;
    }

    try {
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
          return `"${str}"`;
        }
        return str;
      };

      const headerRow = headers.map(escapeCSV).join(',');
      const dataRows = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
      const csvContent = `${headerRow}\n${dataRows}`;

      const fileUri = `${FileSystem.documentDirectory}${fileName}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Ekspor Laporan (Excel/CSV)' });
      } else {
        Alert.alert('Gagal', 'Sistem sharing tidak tersedia.');
      }
    } catch (err: any) {
      Alert.alert('Gagal Ekspor', err.message);
    }
  };

  useEffect(() => {
    const exportableFeatures = ['lap_penjualan', 'lap_omzet', 'lap_terlaris', 'arus_kas', 'stok', 'piutang'];
    if (exportableFeatures.includes(featureId)) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity 
            onPress={handleExportExcelCSV} 
            style={{ marginRight: 15 }}
            activeOpacity={0.7}
          >
            <Download size={20} color={colors.text} />
          </TouchableOpacity>
        )
      });
    } else {
      navigation.setOptions({
        headerRight: undefined
      });
    }
  }, [featureId, navigation, colors, reportsPenjualanState, omzetReportState, rawSoldTransactions, cashflows, stockLogs, debts, salesTransactions, omzetPeriodType, soldMonthFilter, soldYearFilter, salesAnalyticsClearedAt]);

  // --- FORM NAV ACTION (ADD/EDIT/DELETE) ---
  const openFormModal = (item?: any) => {
    Vibration.vibrate(15);
    if (item) {
      setEditId(item.id);
      setFormName(item.name || '');
      if (featureId === 'ekstra') {
        const itemOptions = item.options?.map((o: any) => ({ name: o.name, price: o.price.toString() })) || [{ name: '', price: '0' }];
        setFormOptions(itemOptions);
        setFormIsMandatory(item.isMandatory ?? false);
        setFormAllowMultiple(item.allowMultiple ?? false);
        setFormHasMaxLimit(item.hasMaxLimit ?? false);
        setFormMaxLimit(item.maxLimit?.toString() || '1');
        setFormIsActive(item.isActive ?? true);
      } else if (featureId === 'diskon') {
        setDiscountType(item.type || 'percent');
        setDiscountValue(item.value?.toString() || '0');
        setDiscountStartDate(item.startDate || new Date().toISOString().split('T')[0]);
        setDiscountEndDate(item.endDate || '');
        setDiscountIsActive(item.isActive ?? true);
        setTempSelectedProductIds(item.appliedProductIds || []);
      } else {
        setFormBaseCost(item.baseCost?.toString() || '');
        setFormPrice(item.price?.toString() || '');
        setFormCustomer(item.customer || '');
        setFormAmount(item.amount?.toString() || '');
        setFormStatus(item.status || '');
        setFormCapacity(item.capacity || '50%');
        setFormItemsCount(item.items?.toString() || '');
        setFormCategory(item.category || '');
        setFormCode(item.code || '');
        setFormVal(item.val || '');
        setFormPhone(item.phone || '');
        setFormPoints(item.points?.toString() || '');
        setFormOrders(item.orders?.toString() || '');
        setFormRole(item.role || '');
        setFormTime(item.time || '');
        setFormType(item.type || 'in');
        setFormActual(item.actual?.toString() || '');
        setFormExpected(item.expected?.toString() || '');
        setFormQty(item.qty?.toString() || '');
        setFormDate(item.date || '');
        setFormUser(item.cashier || item.user || '');
      }
    } else {
      setEditId(null);
      setFormName('');
      setFormBaseCost('');
      setFormPrice('');
      setFormCustomer('');
      setFormAmount('');
      setFormStatus('');
      setFormCapacity('50%');
      setFormItemsCount('');
      setFormCategory('');
      setFormCode('');
      setFormVal('');
      setFormPhone('');
      setFormPoints('');
      setFormOrders('');
      setFormRole('');
      setFormTime('');
      setFormType('in');
      setFormActual('');
      setFormExpected('');
      setFormQty('');
      setFormDate('');
      setFormUser('');
      
      // Extras defaults
      setFormOptions([{ name: '', price: '0' }]);
      setFormIsMandatory(false);
      setFormAllowMultiple(false);
      setFormHasMaxLimit(false);
      setFormMaxLimit('1');
      setFormIsActive(true);

      // Discount defaults
      setDiscountType('percent');
      setDiscountValue('0');
      setDiscountStartDate(new Date().toISOString().split('T')[0]);
      setDiscountEndDate('');
      setDiscountIsActive(true);
      setTempSelectedProductIds([]);
    }
    setIsAddModalVisible(true);
  };

  const handleResetStartingCashMobile = async () => {
    if (resetConfirmText !== 'Kosongkan Saldo') {
      Alert.alert('Eror', 'Teks konfirmasi salah!');
      return;
    }
    if (!myActiveShift) return;

    setIsResettingShift(true);
    try {
      const shiftRef = doc(db, 'shifts', myActiveShift.id);
      await updateDoc(shiftRef, {
        startingCash: 0
      });
      Alert.alert('Sukses', 'Modal awal berhasil dikosongkan!');
      setIsResetShiftModalOpen(false);
      setResetConfirmText('');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal mereset modal awal.');
    } finally {
      setIsResettingShift(false);
    }
  };

  const handleStartShiftMobile = async () => {
    if (!startingCash) {
      Alert.alert('Eror', 'Harap masukkan Modal Awal');
      return;
    }
    setIsShiftProcessing(true);
    try {
      await addDoc(collection(db, 'shifts'), {
        storeId,
        userId: user?.uid,
        userName: user?.displayName || user?.email?.split('@')[0] || 'Kasir',
        userEmail: user?.email || '',
        startTime: new Date().toISOString(),
        startingCash: parseFloat(startingCash) || 0,
        systemCalculatedCash: 0,
        actualCash: 0,
        status: 'open',
        notes: ''
      });
      Alert.alert('Sukses', 'Shift Berhasil Dibuka! Selamat Bekerja.');
      setStartingCash('');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal membuka shift.');
    } finally {
      setIsShiftProcessing(false);
    }
  };

  const handleCloseShiftMobile = async () => {
    if (!myActiveShift) return;
    if (!actualCash) {
      Alert.alert('Eror', 'Harap masukkan Uang Fisik');
      return;
    }
    setIsShiftProcessing(true);
    try {
      const shiftRef = doc(db, 'shifts', myActiveShift.id);
      const totalSystemCash = activeShiftStats.cashSales;
      const actual = parseFloat(actualCash) || 0;
      const diff = actual - (myActiveShift.startingCash + totalSystemCash);

      await updateDoc(shiftRef, {
        status: 'closed',
        endTime: new Date().toISOString(),
        actualCash: actual,
        expectedCash: myActiveShift.startingCash + totalSystemCash,
        difference: diff,
        systemCalculatedCash: myActiveShift.startingCash + totalSystemCash,
        totalSales: totalSystemCash,
        cashierId: myActiveShift.userId,
        cashierName: myActiveShift.userName,
        notes: closeNote,
      });

      // Also add to cashier_sessions for backward compatibility/history screen
      await addDoc(collection(db, 'cashier_sessions'), {
        storeId: storeId,
        expectedCash: myActiveShift.startingCash + totalSystemCash,
        systemCalculatedCash: myActiveShift.startingCash + totalSystemCash,
        actualCash: actual,
        difference: diff,
        closedBy: myActiveShift.userName,
        cashierName: myActiveShift.userName,
        closedAt: new Date().toISOString(),
        timestamp: new Date(),
        note: `Shift Closed: ${closeNote}`
      });

      setIsCloseShiftModalOpen(false);
      setActualCash('');
      setCloseNote('');
      Alert.alert('Sukses', 'Shift berhasil ditutup.');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal menutup shift.');
    } finally {
      setIsShiftProcessing(false);
    }
  };

  const handleDelete = async (id: string, colName: string) => {
    Alert.alert(
      'Konfirmasi Hapus',
      'Apakah Anda yakin ingin menghapus data ini secara permanen?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            Vibration.vibrate(15);
            try {
              let col = '';
              if (colName === 'ekstra') col = 'product_extras';
              else if (colName === 'estimasi') col = 'estimations';
              else if (colName === 'piutang') col = 'transactions';
              else if (colName === 'gudang') col = 'warehouses';
              else if (colName === 'diskon') col = 'discounts';
              else if (colName === 'pelanggan') col = 'customers';
              else if (colName === 'staff') col = 'users';
              else if (colName === 'shift') col = 'shifts';
              else if (colName === 'arus_kas') col = 'cash_flow';
              else if (colName === 'tutup_buku') col = 'cashier_sessions';
              else if (colName === 'stok') col = 'stock_history';
              else if (colName === 'expired') col = 'products';
              
              if (col) {
                await deleteDoc(doc(db, col, id));
                Alert.alert('Berhasil', 'Data berhasil dihapus.');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Gagal', 'Gagal menghapus data.');
            }
          }
        }
      ]
    );
  };

  const handlePrintA4 = async (item: any) => {
    try {
      if (!storeId) return;
      Vibration.vibrate(15);
      const settingsSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;
      await printA4(item, settingsData);
    } catch (err: any) {
      console.error(err);
      const errMsg = (err.message || String(err));
      if (errMsg.includes('already in progress')) {
        Alert.alert('Sistem Sibuk', 'Sistem cetak perangkat Anda sedang memproses dokumen. Harap tunggu beberapa detik lalu coba kembali.');
      } else {
        Alert.alert('Gagal', 'Terjadi kesalahan saat memproses cetak A4: ' + errMsg);
      }
    }
  };

  const handlePrintThermal = async (item: any) => {
    try {
      if (!storeId) return;
      Vibration.vibrate(15);
      const settingsSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;
      await printReceipt(item, settingsData);
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat memproses cetak Thermal.');
    }
  };

  const openPermissionModal = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setEditPermissions({
      canAccessPOS: staffMember.permissions?.canAccessPOS ?? true,
      canManageProducts: staffMember.permissions?.canManageProducts ?? false,
      canCreateProducts: staffMember.permissions?.canCreateProducts ?? staffMember.permissions?.canManageProducts ?? false,
      canEditProducts: staffMember.permissions?.canEditProducts ?? staffMember.permissions?.canManageProducts ?? false,
      canDeleteProducts: staffMember.permissions?.canDeleteProducts ?? staffMember.permissions?.canManageProducts ?? false,
      canViewReports: staffMember.permissions?.canViewReports ?? false,
      canManageUsers: staffMember.permissions?.canManageUsers ?? false,
      canEditSettings: staffMember.permissions?.canEditSettings ?? false,
      canManageEstimations: staffMember.permissions?.canManageEstimations ?? false,
      canManageDebts: staffMember.permissions?.canManageDebts ?? false,
      canManageOrders: staffMember.permissions?.canManageOrders ?? false,
      canViewLogs: staffMember.permissions?.canViewLogs ?? false
    });
    setIsPermModalOpen(true);
  };

  const handleUpdatePermissions = async () => {
    if (!selectedStaff) return;
    setIsSavingPerms(true);
    try {
      await updateDoc(doc(db, 'users', selectedStaff.id), {
        permissions: editPermissions
      });

      // Log Permission Update
      await addDoc(collection(db, 'activity_logs'), {
        userId: user?.uid || 'unknown',
        userName: user?.name || user?.displayName || 'Admin',
        userEmail: user?.email || '-',
        storeId: storeId || 'unknown',
        action: 'EDIT_USER',
        description: `Memperbarui izin akses untuk user: ${selectedStaff.name || selectedStaff.email}`,
        timestamp: new Date().toISOString()
      });

      Alert.alert('Sukses', 'Izin pengguna berhasil diperbarui!');
      setIsPermModalOpen(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memperbarui izin: ' + err.message);
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleDeleteStaff = async (staffMember: any) => {
    if (staffMember.id === user?.uid) {
      Alert.alert('Eror', 'Anda tidak dapat menghapus akun Anda sendiri dari menu ini.');
      return;
    }

    if (staffMember.role === 'admin' && staffs.filter(usr => usr.role === 'admin').length <= 1) {
      Alert.alert('Eror', 'Harap sisakan minimal satu Administrator di sistem!');
      return;
    }

    Alert.alert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus user "${staffMember.name || staffMember.email}"? Tindakan ini tidak dapat dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            Vibration.vibrate(15);
            try {
              await deleteDoc(doc(db, 'users', staffMember.id));

              // Log User Deletion
              await addDoc(collection(db, 'activity_logs'), {
                userId: user?.uid || 'unknown',
                userName: user?.name || user?.displayName || 'Admin',
                userEmail: user?.email || '-',
                storeId: storeId || 'unknown',
                action: 'DELETE_USER',
                description: `Menghapus user: ${staffMember.name} (${staffMember.email})`,
                timestamp: new Date().toISOString()
              });

              Alert.alert('Sukses', 'User berhasil dihapus!');
            } catch (err: any) {
              console.error(err);
              Alert.alert('Eror', 'Gagal menghapus user: ' + err.message);
            }
          }
        }
      ]
    );
  };

  // --- SAVE ACTION ---
  const handleSave = async () => {
    Vibration.vibrate(15);
    if (!storeId) return;

    try {
      const bc = parseFloat(formBaseCost) || 0;
      const pr = parseFloat(formPrice) || 0;

      switch (featureId) {
        case 'estimasi':
          if (!formName || !formBaseCost || !formPrice) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          await addDoc(collection(db, 'estimations'), {
            storeId,
            customerName: formName,
            total: pr,
            status: 'active',
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            timestamp: new Date().toISOString(),
            items: [{
              productName: formName,
              qty: 1,
              price: pr,
              baseCost: bc,
              subtotal: pr
            }]
          });
          break;

        case 'piutang':
          if (!formCustomer || !formAmount) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          await addDoc(collection(db, 'transactions'), {
            storeId,
            customerName: formCustomer,
            total: parseFloat(formAmount) || 0,
            paidAmount: 0,
            debtAmount: parseFloat(formAmount) || 0,
            paymentCategory: 'debt',
            paymentStatus: formStatus || 'unpaid',
            orderStatus: 'completed',
            cashierName: user?.name || user?.displayName || 'Kasir',
            timestamp: new Date().toISOString(),
            items: [{
              productName: 'Hutang Manual',
              qty: 1,
              price: parseFloat(formAmount) || 0,
              subtotal: parseFloat(formAmount) || 0
            }]
          });
          break;

        case 'gudang':
          // Managed via handleAdjustStock
          break;

        case 'ekstra':
          if (!formName) {
            Alert.alert('Eror', 'Nama grup ekstra wajib diisi');
            return;
          }
          const cleanOptions = formOptions
            .filter(o => o.name.trim() !== '')
            .map(o => ({ name: o.name.trim(), price: parseFloat(o.price) || 0 }));
          
          if (cleanOptions.length === 0) {
            Alert.alert('Eror', 'Minimal harus ada 1 opsi pilihan produk ekstra');
            return;
          }

          const extraData = {
            storeId,
            name: formName,
            options: cleanOptions,
            isMandatory: formIsMandatory,
            allowMultiple: formAllowMultiple,
            hasMaxLimit: formHasMaxLimit,
            maxLimit: parseInt(formMaxLimit) || 1,
            isActive: formIsActive
          };

          if (editId) {
            await updateDoc(doc(db, 'product_extras', editId), extraData);
          } else {
            await addDoc(collection(db, 'product_extras'), extraData);
          }
          break;

        case 'diskon':
          if (!formName.trim() || !discountValue) {
            Alert.alert('Eror', 'Harap isi nama promo dan besaran potongan');
            return;
          }
          if (tempSelectedProductIds.length === 0) {
            Alert.alert('Eror', 'Harap pilih minimal 1 produk target diskon');
            return;
          }
          const valNum = parseFloat(discountValue) || 0;
          const discountData = {
            storeId,
            name: formName.trim(),
            type: discountType,
            value: valNum,
            startDate: discountStartDate || new Date().toISOString().split('T')[0],
            endDate: discountEndDate || '',
            isActive: discountIsActive,
            appliedProductIds: tempSelectedProductIds
          };

          if (editId) {
            await updateDoc(doc(db, 'discounts', editId), discountData);
          } else {
            await addDoc(collection(db, 'discounts'), discountData);
          }
          break;

        case 'pelanggan':
          if (!formName || !formPhone) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          await addDoc(collection(db, 'customers'), {
            storeId,
            name: formName,
            phone: formPhone,
            points: parseInt(formPoints) || 0,
            orders: parseInt(formOrders) || 0,
            createdAt: new Date().toISOString()
          });
          break;

        case 'staff':
          if (!formName || !formEmail || !formPassword || !formRole) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          if (formPassword.length < 6) {
            Alert.alert('Eror', 'Kata sandi minimal 6 karakter');
            return;
          }
          if (staffs.length >= maxUsers) {
            Alert.alert('Eror', `Kuota user penuh! Maksimal ${maxUsers} user. Hubungi Super Admin untuk menambah kuota.`);
            return;
          }

          // 1. Dapatkan config dari primary app
          const primaryApp = getApp();
          const firebaseConfig = primaryApp.options;

          // 2. Buat secondary app instance
          const secondaryAppName = `SecondaryApp_${Date.now()}`;
          const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          const secondaryAuth = getAuth(secondaryApp);

          try {
            // 3. Buat user baru di Firebase Auth menggunakan secondary app
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              formEmail.trim(),
              formPassword
            );

            // 4. Logout secondary user & bersihkan app instance
            await signOut(secondaryAuth);
            await deleteApp(secondaryApp);

            // 5. Simpan hak akses role ke koleksi Firestore ('users')
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              name: formName.trim(),
              email: formEmail.trim(),
              role: formRole, // 'admin' or 'cashier'
              storeId: storeId,
              storeName: '',
              permissions: {
                canAccessPOS: true,
                canManageProducts: formRole === 'admin',
                canCreateProducts: formRole === 'admin',
                canEditProducts: formRole === 'admin',
                canDeleteProducts: formRole === 'admin',
                canViewReports: formRole === 'admin',
                canManageUsers: formRole === 'admin',
                canEditSettings: formRole === 'admin',
                canManageEstimations: formRole === 'admin',
                canManageDebts: formRole === 'admin',
                canManageOrders: formRole === 'admin',
                canViewLogs: formRole === 'admin'
              },
              isActive: true,
              isSubscribed: !!subscriptionUntil,
              validUntil: subscriptionUntil || '',
              createdAt: new Date().toISOString()
            });

            // 6. Log Activity
            await addDoc(collection(db, 'activity_logs'), {
              userId: user?.uid || 'unknown',
              userName: user?.name || user?.displayName || 'Admin',
              userEmail: user?.email || '-',
              storeId: storeId || 'unknown',
              action: 'ADD_USER',
              description: `Menambahkan user baru: ${formName.trim()} (${formEmail.trim()}) sebagai ${formRole === 'admin' ? 'Administrator' : 'Kasir'}`,
              timestamp: new Date().toISOString()
            });

            Alert.alert('Sukses', 'Berhasil mendaftarkan pengguna baru!');
          } catch (createErr: any) {
            console.error(createErr);
            try {
              await deleteApp(secondaryApp);
            } catch (cleanupErr) {}

            let msg = 'Gagal menambahkan user';
            if (createErr.code === 'auth/email-already-in-use') {
              msg = 'Email sudah terdaftar. Silakan gunakan email lain.';
            } else if (createErr.code === 'auth/weak-password') {
              msg = 'Kata sandi terlalu lemah. Minimal 6 karakter.';
            } else if (createErr.code === 'auth/invalid-email') {
              msg = 'Format email tidak valid.';
            } else {
              msg = createErr.message || msg;
            }
            Alert.alert('Eror', msg);
            return;
          }
          break;

        case 'shift':
          if (!formName || !formRole || !formTime) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          await addDoc(collection(db, 'shifts'), {
            storeId,
            staffName: formName,
            role: formRole,
            time: formTime,
            status: formStatus || 'Aktif'
          });
          break;

        case 'arus_kas':
          if (!formName || !formAmount) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          const cfCat = formCategory || (formType === 'in' ? 'modal' : 'operasional');
          await addDoc(collection(db, 'cash_flow'), {
            storeId,
            type: formType,
            category: cfCat,
            amount: parseFloat(formAmount) || 0,
            description: formName,
            timestamp: new Date().toISOString(),
            userEmail: user?.email || 'admin'
          });
          break;

        case 'tutup_buku':
          if (!formUser || !formActual || !formExpected) {
            Alert.alert('Eror', 'Harap isi semua kolom');
            return;
          }
          const act = parseFloat(formActual) || 0;
          const exp = parseFloat(formExpected) || 0;
          const diff = act - exp;
          await addDoc(collection(db, 'cashier_sessions'), {
            storeId,
            expectedCash: exp,
            systemCalculatedCash: exp,
            actualCash: act,
            difference: diff,
            closedBy: formUser,
            cashierName: formUser,
            closedAt: new Date().toISOString(),
            timestamp: new Date(),
            note: formName || 'Tutup Buku Sesi'
          });
          break;

        case 'stok':
        case 'expired':
          // Managed via other pages/modals
          break;
      }

      // Reset inputs
      setFormName('');
      setFormBaseCost('');
      setFormPrice('');
      setFormCustomer('');
      setFormAmount('');
      setFormStatus('');
      setFormCapacity('50%');
      setFormItemsCount('');
      setFormCategory('');
      setFormCode('');
      setFormVal('');
      setFormPhone('');
      setFormPoints('');
      setFormOrders('');
      setFormRole('');
      setFormTime('');
      setFormType('in');
      setFormActual('');
      setFormExpected('');
      setFormQty('');
      setFormDate('');
      setFormUser('');
      setFormEmail('');
      setFormPassword('');
      
      // Discount states reset
      setDiscountType('percent');
      setDiscountValue('0');
      setDiscountStartDate(new Date().toISOString().split('T')[0]);
      setDiscountEndDate('');
      setDiscountIsActive(true);
      setTempSelectedProductIds([]);
      
      setIsAddModalVisible(false);

    } catch (error) {
      console.error("Error saving document:", error);
      Alert.alert('Error', 'Gagal menyimpan data ke database cloud.');
    }
  };

  const handleAdjustStock = async () => {
    if (!selectedProduct || !selectedProduct.id || !storeId || !user) return;
    setIsSavingStock(true);
    Vibration.vibrate(15);
    try {
      const qtyNum = parseFloat(mutationQty);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        Alert.alert('Eror', 'Kuantitas harus berupa angka lebih dari 0');
        setIsSavingStock(false);
        return;
      }

      let finalStock = selectedProduct.stock || 0;
      if (mutationType === 'masuk') finalStock += qtyNum;
      else if (mutationType === 'keluar') finalStock -= qtyNum;
      else if (mutationType === 'penyesuaian') finalStock = qtyNum;

      if (finalStock < 0) finalStock = 0;

      // 1. Update stock in products
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        stock: finalStock,
        updatedAt: new Date().toISOString()
      });

      // 2. Write to stock_history
      const mutationData = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: mutationType,
        qty: qtyNum,
        note: mutationNote || (mutationType === 'penyesuaian' ? 'Opname Manual' : 'Penyesuaian Gudang'),
        timestamp: new Date(),
        userEmail: user.email || 'unknown',
        storeId: storeId
      };
      await addDoc(collection(db, 'stock_history'), mutationData);

      setIsAdjustModalVisible(false);
      setSelectedProduct(null);
      setMutationQty('');
      setMutationNote('');
      Alert.alert('Berhasil', 'Penyesuaian stok berhasil disimpan.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', err.message || 'Gagal menyimpan penyesuaian stok');
    } finally {
      setIsSavingStock(false);
    }
  };

  const handlePayInstallment = async () => {
    if (!selectedDebt || !selectedDebt.id) return;
    const amount = parseFloat(debtPaymentAmount) || 0;
    if (amount <= 0) {
      Alert.alert('Eror', 'Jumlah pembayaran harus lebih dari Rp 0');
      return;
    }

    setIsSubmittingDebtPayment(true);
    Vibration.vibrate(15);
    try {
      const currentPaid = selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0;
      const newPaid = currentPaid + amount;
      const remaining = selectedDebt.total - newPaid;
      
      const newStatus = remaining <= 0 ? 'paid' : 'partially_paid';
      const change = remaining < 0 ? Math.abs(remaining) : 0;

      const newHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        amount: amount,
        date: new Date().toISOString(),
        cashierName: user?.name || user?.displayName || 'Kasir',
        note: debtPaymentNote || 'Pembayaran cicilan mobile'
      };

      const updatedHistory = [...(selectedDebt.paymentHistory || []), newHistoryItem];

      await updateDoc(doc(db, 'transactions', selectedDebt.id), {
        paidAmount: newPaid,
        debtAmount: Math.max(0, remaining),
        cashReceived: newPaid, // Keep for backward compatibility
        change: change,
        paymentStatus: newStatus,
        paymentHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      Alert.alert('Berhasil', newStatus === 'paid' ? 'Hutang berhasil dilunasi!' : 'Pembayaran cicilan berhasil dicatat.');
      setSelectedDebt(null);
      setDebtPaymentAmount('');
      setDebtPaymentNote('Pembayaran cicilan mobile');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan pembayaran.');
    } finally {
      setIsSubmittingDebtPayment(false);
    }
  };

  const handleUpdateHistoryNote = async (histId: string) => {
    if (!selectedDebt || !selectedDebt.id || !selectedDebt.paymentHistory) return;
    try {
      const updatedHistory = selectedDebt.paymentHistory.map((h: any, i: number) => {
        const id = h.id || i.toString();
        if (id === histId) {
          return { ...h, note: editDebtNoteValue };
        }
        return h;
      });
      await updateDoc(doc(db, 'transactions', selectedDebt.id), {
        paymentHistory: updatedHistory
      });
      setSelectedDebt({ ...selectedDebt, paymentHistory: updatedHistory });
      setEditingDebtNoteId(null);
      Alert.alert('Berhasil', 'Catatan berhasil diperbarui');
    } catch (err) {
      console.error(err);
      Alert.alert('Gagal', 'Gagal memperbarui catatan');
    }
  };

  const handleDeleteDebtItem = async (idx: number) => {
    if (!selectedDebt || !selectedDebt.id || !selectedDebt.items) return;
    try {
      const newItems = [...selectedDebt.items];
      newItems.splice(idx, 1);
      
      const newTotal = newItems.reduce((acc: any, curr: any) => acc + (curr.subtotal || 0), 0);
      const paid = selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0;
      const newDebtAmount = Math.max(0, newTotal - paid);
      const newStatus = newDebtAmount <= 0 ? 'paid' : selectedDebt.paymentStatus;
      
      await updateDoc(doc(db, 'transactions', selectedDebt.id), {
        items: newItems,
        total: newTotal,
        debtAmount: newDebtAmount,
        paymentStatus: newStatus
      });
      setSelectedDebt({...selectedDebt, items: newItems, total: newTotal, debtAmount: newDebtAmount, paymentStatus: newStatus});
      Vibration.vibrate(10);
      Alert.alert('Sukses', 'Item berhasil dihapus');
    } catch (e) {
      console.error(e);
      Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus item');
    }
  };

  const handleSaveDebtItem = async () => {
    if (editingDebtItemIndex === null || !selectedDebt) return;
    try {
      const newItems = [...selectedDebt.items];
      const qtyNum = parseFloat(editDebtItemData.qty) || 1;
      const priceNum = parseFloat(editDebtItemData.price) || 0;
      const newSubtotal = qtyNum * priceNum;
      
      newItems[editingDebtItemIndex] = {
        ...newItems[editingDebtItemIndex],
        qty: qtyNum,
        price: priceNum,
        subtotal: newSubtotal,
        note: editDebtItemData.note
      };
      
      const newTotal = newItems.reduce((acc: any, curr: any) => acc + (curr.subtotal || 0), 0);
      const paid = selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0;
      const newDebtAmount = Math.max(0, newTotal - paid);
      const newStatus = newDebtAmount <= 0 ? 'paid' : (selectedDebt.paymentStatus === 'paid' && newDebtAmount > 0 ? 'partially_paid' : selectedDebt.paymentStatus);
      
      await updateDoc(doc(db, 'transactions', selectedDebt.id), {
        items: newItems,
        total: newTotal,
        debtAmount: newDebtAmount,
        paymentStatus: newStatus
      });
      setSelectedDebt({...selectedDebt, items: newItems, total: newTotal, debtAmount: newDebtAmount, paymentStatus: newStatus});
      setEditingDebtItemIndex(null);
      Vibration.vibrate(10);
      Alert.alert('Sukses', 'Data item berhasil diubah');
    } catch (e) {
      console.error(e);
      Alert.alert('Gagal', 'Terjadi kesalahan saat mengubah item');
    }
  };

  const handleShareSignatureLink = async (type: string, id: string) => {
    try {
      Vibration.vibrate(10);
      const collectionName = type === 'est' ? 'estimations' : 'transactions';
      await updateDoc(doc(db, collectionName, id), {
        isSignatureLinkActive: true
      });
      
      const url = `https://kasirkuyk.web.app/sign?type=${type}&id=${id}`;
      
      await Share.share({
        title: 'Form Tanda Tangan',
        message: `Silakan klik link berikut untuk menandatangani dokumen Anda:\n${url}`,
      });
    } catch (err) {
      console.error('Error sharing/activating:', err);
      Alert.alert('Gagal', 'Gagal mengaktifkan link tanda tangan');
    }
  };

  // --- FORM FIELDS INJECTOR ---
  const renderTextInput = (label: string, value: string, onChangeText: (t: string) => void, placeholder: string, keyboardType: any = 'default', secureTextEntry: boolean = false) => (
    <View className="mb-4">
      <Text className="text-[10px] font-black uppercase mb-1.5" style={{ color: colors.textMuted }}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        className="px-4 py-3.5 rounded-2xl border font-bold text-xs"
        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
      />
    </View>
  );

  const renderToggleInput = (label: string, options: string[], labels: string[], value: string, setValue: (v: string) => void) => (
    <View className="mb-4">
      <Text className="text-[10px] font-black uppercase mb-1.5" style={{ color: colors.textMuted }}>{label}</Text>
      <View className="flex-row gap-2">
        {options.map((opt, idx) => {
          const isSelected = value === opt || (!value && idx === 0);
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                Vibration.vibrate(10);
                setValue(opt);
              }}
              activeOpacity={0.8}
              className="flex-1 py-3.5 rounded-2xl border items-center justify-center"
              style={{
                backgroundColor: isSelected ? colors.accent : colors.bg,
                borderColor: isSelected ? colors.accent : colors.border
              }}
            >
              <Text className="text-xs font-black" style={{ color: isSelected ? '#ffffff' : colors.text }}>
                {labels[idx]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderFormFields = () => {
    switch (featureId) {
      case 'estimasi':
        return (
          <>
            {renderTextInput('Nama Menu / Resep', formName, setFormName, 'e.g. Nasi Goreng Spesial')}
            {renderTextInput('HPP / Bahan Pokok (Rp)', formBaseCost, setFormBaseCost, 'e.g. 8000', 'numeric')}
            {renderTextInput('Harga Jual POS (Rp)', formPrice, setFormPrice, 'e.g. 15000', 'numeric')}
          </>
        );
      case 'piutang':
        return (
          <>
            {renderTextInput('Nama Pelanggan', formCustomer, setFormCustomer, 'e.g. Bapak Subur')}
            {renderTextInput('Jumlah Piutang / Hutang', formAmount, setFormAmount, 'e.g. 150000', 'numeric')}
            {renderToggleInput('Status Hutang', ['unpaid', 'partially_paid'], ['Belum Lunas', 'Dicicil'], formStatus, setFormStatus)}
          </>
        );
      case 'gudang':
        return null;
      case 'ekstra':
        return (
          <View className="flex gap-4">
            {/* Nama Grup */}
            <View>
              <Text className="text-[10px] font-black uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textMuted }}>Nama Grup Ekstra</Text>
              <TextInput
                placeholder="Misal: Pilihan Topping, Level Pedas"
                placeholderTextColor={colors.textMuted + '60'}
                value={formName}
                onChangeText={setFormName}
                className="p-4 rounded-2xl border font-bold"
                style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
              />
            </View>

            {/* Options List */}
            <View className="mt-2 border-t pt-4" style={{ borderColor: colors.border + '20' }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-[10px] font-black uppercase tracking-wider ml-1" style={{ color: colors.textMuted }}>Daftar Opsi Pilihan</Text>
                <TouchableOpacity
                  onPress={() => setFormOptions(prev => [...prev, { name: '', price: '0' }])}
                  className="flex-row items-center gap-1"
                >
                  <Plus size={14} color={colors.accent} style={{ marginRight: 2 }} />
                  <Text className="text-[9px] font-black text-accent uppercase tracking-wider">Tambah Opsi</Text>
                </TouchableOpacity>
              </View>

              <View className="flex gap-3">
                {formOptions.map((option, index) => (
                  <View key={index} className="flex-row gap-2 items-center">
                    {/* Option Name */}
                    <TextInput
                      placeholder="Nama Opsi (e.g. Keju)"
                      placeholderTextColor={colors.textMuted + '60'}
                      value={option.name}
                      onChangeText={(text) => {
                        const next = [...formOptions];
                        next[index].name = text;
                        setFormOptions(next);
                      }}
                      className="flex-1 p-3 rounded-xl border text-xs font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                    />

                    {/* Option Price */}
                    <View className="w-28 relative">
                      <TextInput
                        placeholder="Harga (Rp)"
                        placeholderTextColor={colors.textMuted + '60'}
                        keyboardType="numeric"
                        value={option.price === '0' ? '' : option.price}
                        onChangeText={(text) => {
                          const next = [...formOptions];
                          next[index].price = text;
                          setFormOptions(next);
                        }}
                        className="p-3 pl-6 rounded-xl border text-xs font-bold text-center"
                        style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                      />
                      <Text className="absolute left-2.5 top-3.5 text-[9px] font-black text-slate-400">Rp</Text>
                    </View>

                    {/* Remove Option Button */}
                    <TouchableOpacity
                      onPress={() => {
                        if (formOptions.length <= 1) return;
                        setFormOptions(prev => prev.filter((_, idx) => idx !== index));
                      }}
                      disabled={formOptions.length <= 1}
                      className="w-10 h-10 rounded-xl border justify-center items-center opacity-80"
                      style={{ 
                        backgroundColor: colors.bg, 
                        borderColor: formOptions.length <= 1 ? colors.border + '20' : '#f43f5e' + '30' 
                      }}
                    >
                      <Trash2 size={16} color={formOptions.length <= 1 ? colors.textMuted : '#f43f5e'} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Rules Section */}
            <View className="mt-4 border-t pt-4 flex gap-4" style={{ borderColor: colors.border + '20' }}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-black" style={{ color: colors.text }}>Wajib Memilih?</Text>
                  <Text className="text-[8px] font-bold" style={{ color: colors.textMuted }}>Pelanggan harus memilih minimal 1 opsi</Text>
                </View>
                <Switch
                  value={formIsMandatory}
                  onValueChange={setFormIsMandatory}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>

              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-black" style={{ color: colors.text }}>Pilih Lebih dari 1?</Text>
                  <Text className="text-[8px] font-bold" style={{ color: colors.textMuted }}>Boleh pilih beberapa opsi sekaligus</Text>
                </View>
                <Switch
                  value={formAllowMultiple}
                  onValueChange={setFormAllowMultiple}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>

              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-black" style={{ color: colors.text }}>Batasan Maksimal?</Text>
                  <Text className="text-[8px] font-bold" style={{ color: colors.textMuted }}>Batasi jumlah pilihan maksimum</Text>
                </View>
                <Switch
                  value={formHasMaxLimit}
                  onValueChange={setFormHasMaxLimit}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>

              {formHasMaxLimit && (
                <View className="flex-row items-center justify-between pl-4 py-2 border-l border-amber-500/20 bg-amber-500/5 rounded-r-xl">
                  <Text className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Jumlah Maksimal</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={formMaxLimit}
                    onChangeText={setFormMaxLimit}
                    className="w-16 p-2 rounded-lg border text-center font-bold text-xs"
                    style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
                  />
                </View>
              )}

              <View className="flex-row items-center justify-between border-t pt-4" style={{ borderColor: colors.border + '15' }}>
                <View>
                  <Text className="text-xs font-black" style={{ color: colors.text }}>Status Grup Aktif</Text>
                  <Text className="text-[8px] font-bold" style={{ color: colors.textMuted }}>Grup muncul dan dapat dipilih di kasir</Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: colors.border, true: '#10b981' }}
                  thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                />
              </View>
            </View>
          </View>
        );
      case 'diskon':
        return (
          <View className="flex gap-4">
            {renderTextInput('Nama Promo / Campaign', formName, setFormName, 'e.g. Promo Gajian')}
            
            {renderToggleInput(
              'Tipe Diskon',
              ['percent', 'fixed'],
              ['Persen (%)', 'Nominal (Rp)'],
              discountType,
              (v: any) => setDiscountType(v)
            )}

            {renderTextInput(
              discountType === 'percent' ? 'Persen Potongan (%)' : 'Nominal Potongan (Rp)',
              discountValue,
              setDiscountValue,
              discountType === 'percent' ? 'e.g. 10' : 'e.g. 15000',
              'numeric'
            )}

            {renderTextInput(
              'Tanggal Mulai (YYYY-MM-DD)',
              discountStartDate,
              setDiscountStartDate,
              'e.g. 2026-05-29'
            )}

            {renderTextInput(
              'Tanggal Akhir (YYYY-MM-DD, Opsional)',
              discountEndDate,
              setDiscountEndDate,
              'e.g. 2026-06-30'
            )}

            <View className="flex-row items-center justify-between border-t border-b py-4" style={{ borderColor: colors.border + '15' }}>
              <View>
                <Text className="text-xs font-black" style={{ color: colors.text }}>Status Diskon Aktif</Text>
                <Text className="text-[8px] font-bold" style={{ color: colors.textMuted }}>Kupon diskon dapat digunakan di kasir</Text>
              </View>
              <Switch
                value={discountIsActive}
                onValueChange={setDiscountIsActive}
                trackColor={{ false: colors.border, true: '#10b981' }}
                thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
              />
            </View>

            {formName.trim() !== '' && (
              <View className="mt-2">
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    setIsSelectorModalVisible(true);
                  }}
                  activeOpacity={0.8}
                  className="p-4 rounded-2xl border-2 border-dashed flex-row items-center justify-between"
                  style={{
                    borderColor: tempSelectedProductIds.length > 0 ? colors.accent : colors.border,
                    backgroundColor: tempSelectedProductIds.length > 0 ? colors.accent + '10' : 'transparent'
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="p-2 rounded-xl" style={{ backgroundColor: tempSelectedProductIds.length > 0 ? colors.accent : colors.bg }}>
                      <Package size={18} color={tempSelectedProductIds.length > 0 ? '#ffffff' : colors.textMuted} />
                    </View>
                    <View>
                      <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: tempSelectedProductIds.length > 0 ? colors.accent : colors.textMuted }}>Target Produk</Text>
                      <Text className="text-sm font-bold" style={{ color: colors.text }}>
                        {tempSelectedProductIds.length === 0 ? 'Pilih Produk atau Kategori' : `${tempSelectedProductIds.length} Produk Dipilih`}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </TouchableOpacity>
                {tempSelectedProductIds.length === 0 && (
                  <Text className="text-[9px] text-rose-500 font-bold mt-2 text-center uppercase tracking-widest">
                    * Wajib memilih item agar diskon valid.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      case 'pelanggan':
        return (
          <>
            {renderTextInput('Nama Lengkap Pelanggan', formName, setFormName, 'e.g. Budi Santoso')}
            {renderTextInput('No Telepon WhatsApp', formPhone, setFormPhone, 'e.g. 08123456789', 'phone-pad')}
            {renderTextInput('Poin Loyalitas Awal', formPoints, setFormPoints, 'e.g. 100', 'numeric')}
            {renderTextInput('Total Kunjungan', formOrders, setFormOrders, 'e.g. 5', 'numeric')}
          </>
        );
      case 'staff':
        return (
          <>
            {renderTextInput('Nama Lengkap', formName, setFormName, 'e.g. Siti Rahma')}
            {renderTextInput('Alamat Email', formEmail, setFormEmail, 'kasir1@kasirpro.com', 'email-address')}
            {renderTextInput('Password Akses (Min. 6 Karakter)', formPassword, setFormPassword, '••••••', 'default', true)}
            {renderToggleInput('Peran (Role)', ['cashier', 'admin'], ['Kasir Reguler', 'Administrator'], formRole, setFormRole)}
          </>
        );
      case 'shift':
        return (
          <>
            {renderTextInput('Nama Staff / Kasir', formName, setFormName, 'e.g. Budi Santoso')}
            {renderTextInput('Nama / Peran Shift', formRole, setFormRole, 'e.g. Kasir Pagi / Kasir Sore')}
            {renderTextInput('Slot Jam Shift Kerja', formTime, setFormTime, 'e.g. 08:00 - 15:00')}
            {renderToggleInput('Status Shift', ['Aktif', 'Menunggu', 'Selesai'], ['Aktif', 'Menunggu', 'Selesai'], formStatus, setFormStatus)}
          </>
        );
      case 'arus_kas':
        const catOptions = formType === 'in'
          ? [
              { value: 'modal', label: 'Tambahan Modal' },
              { value: 'piutang', label: 'Pelunasan Piutang' },
              { value: 'lainnya', label: 'Lainnya' }
            ]
          : [
              { value: 'operasional', label: 'Operasional' },
              { value: 'belanja', label: 'Belanja Stok' },
              { value: 'listrik', label: 'Listrik & Air' },
              { value: 'gaji', label: 'Gaji Karyawan' },
              { value: 'pribadi', label: 'Pribadi (Prive)' },
              { value: 'lainnya', label: 'Lain-lain' }
            ];
        return (
          <>
            {renderTextInput('Keterangan Arus Kas', formName, setFormName, 'e.g. Restock Telur')}
            {renderTextInput('Jumlah Dana (Rp)', formAmount, setFormAmount, 'e.g. 120000', 'numeric')}
            {renderToggleInput('Tipe Arus Kas', ['in', 'out'], ['Uang Masuk (+)', 'Uang Keluar (-)'], formType, (val) => {
              setFormType(val);
              setFormCategory(val === 'in' ? 'modal' : 'operasional');
            })}
            
            <View className="mb-4">
              <Text className="text-[10px] font-black uppercase mb-1.5" style={{ color: colors.textMuted }}>Kategori Transaksi</Text>
              <View className="flex-row flex-wrap gap-2">
                {catOptions.map((opt) => {
                  const isSelected = formCategory === opt.value || (!formCategory && opt.value === (formType === 'in' ? 'modal' : 'operasional'));
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => {
                        Vibration.vibrate(10);
                        setFormCategory(opt.value);
                      }}
                      activeOpacity={0.8}
                      className="px-3.5 py-2.5 rounded-2xl border"
                      style={{
                        backgroundColor: isSelected ? colors.accent : colors.bg,
                        borderColor: isSelected ? colors.accent : colors.border
                      }}
                    >
                      <Text className="text-[10px] font-black" style={{ color: isSelected ? '#ffffff' : colors.text }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        );
      case 'tutup_buku':
        return (
          <>
            {renderTextInput('Kasir Penanggung Jawab', formUser, setFormUser, 'e.g. Kasir Budi')}
            {renderTextInput('Total Laci Uang Aktual (Rp)', formActual, setFormActual, 'e.g. 1250000', 'numeric')}
            {renderTextInput('Total Kas Tercatat Sistem (Rp)', formExpected, setFormExpected, 'e.g. 1250000', 'numeric')}
            {renderTextInput('Catatan (Opsional)', formName, setFormName, 'e.g. Selesai rekap hari ini...')}
          </>
        );
      case 'stok':
      case 'expired':
        return null;
      default:
        return null;
    }
  };

  // --- RENDER CONTENT BY FEATURE ---
  const renderContent = () => {
    switch (featureId) {
      case 'estimasi':
        const filteredEstimations = estimations.filter(e => {
          const matchesSearch = (e.customerName || e.name || '').toLowerCase().includes(search.toLowerCase());
          const matchesFilter = (e.status || 'active') === estimationFilter;
          return matchesSearch && matchesFilter;
        });

        return (
          <View className="flex-1">
            {/* Filter Tabs */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-4">
              <TouchableOpacity
                onPress={() => setEstimationFilter('active')}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: estimationFilter === 'active' ? colors.accent : 'transparent' }}
              >
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: estimationFilter === 'active' ? '#ffffff' : colors.text }}>
                  Aktif
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEstimationFilter('converted')}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: estimationFilter === 'converted' ? colors.accent : 'transparent' }}
              >
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: estimationFilter === 'converted' ? '#ffffff' : colors.text }}>
                  Selesai
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEstimationFilter('cancelled')}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: estimationFilter === 'cancelled' ? colors.accent : 'transparent' }}
              >
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: estimationFilter === 'cancelled' ? '#ffffff' : colors.text }}>
                  Batal
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredEstimations}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isValid = item.validUntil ? new Date(item.validUntil) > new Date() : true;
                const totalVal = item.total ?? item.price ?? 0;
                const dateStr = item.timestamp ? (item.timestamp.toDate ? item.timestamp.toDate().toLocaleDateString('id-ID') : new Date(item.timestamp).toLocaleDateString('id-ID')) : 'Baru saja';
                
                return (
                  <View className="p-5 rounded-3xl border mb-3 flex gap-3.5 relative overflow-hidden" style={{ backgroundColor: colors.surface, borderColor: !isValid && item.status === 'active' ? '#fca5a5' : colors.border }}>
                    {!isValid && item.status === 'active' && (
                      <View className="absolute top-0 right-0 bg-rose-500 px-3 py-1 rounded-bl-2xl" style={{ zIndex: 10 }}>
                        <Text className="text-[8px] font-black text-white uppercase tracking-widest">EXPIRED</Text>
                      </View>
                    )}
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-black" style={{ color: colors.text }}>{item.customerName || item.name || 'Menu Estimasi'}</Text>
                        <Text className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          Dibuat: {dateStr}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Estimasi</Text>
                        <Text className="text-sm font-black text-emerald-500">Rp {totalVal.toLocaleString('id-ID')}</Text>
                      </View>
                    </View>

                    {item.items && item.items.length > 0 ? (
                      <View className="p-3 bg-black/10 rounded-2xl flex gap-1.5">
                        {item.items.slice(0, 3).map((sub: any, idx: number) => (
                          <View key={idx} className="flex-row justify-between items-center">
                            <Text className="text-[10px] font-bold" style={{ color: colors.text }}>{sub.qty}x {sub.productName}</Text>
                            <Text className="text-[10px] font-bold text-slate-400">Rp {sub.subtotal?.toLocaleString('id-ID') || sub.price?.toLocaleString('id-ID')}</Text>
                          </View>
                        ))}
                        {item.items.length > 3 && (
                          <Text className="text-[9px] text-slate-400 italic">+{item.items.length - 3} item lainnya...</Text>
                        )}
                      </View>
                    ) : (
                      <View className="p-3 bg-black/5 rounded-2xl">
                        <Text className="text-[10px] font-bold text-slate-400">HPP: Rp {item.baseCost?.toLocaleString('id-ID')} • Jual: Rp {item.price?.toLocaleString('id-ID')}</Text>
                      </View>
                    )}

                    {item.validUntil && (
                      <View className="flex-row justify-between items-center p-2.5 bg-black/5 rounded-xl border border-black/5" style={{ borderColor: !isValid && item.status === 'active' ? 'rgba(239, 68, 68, 0.2)' : 'transparent' }}>
                        <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Berlaku Hingga:</Text>
                        <View className="flex-row items-center gap-1.5" style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text className={`text-[9px] font-black uppercase ${isValid ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {new Date(item.validUntil).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Text>
                          {!isValid && item.status === 'active' && (
                            <View className="bg-rose-500 px-1.5 py-0.5 rounded">
                              <Text className="text-[7px] font-black text-white uppercase tracking-wider">Expired</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    <View className="flex-row flex-wrap gap-2 pt-2 border-t" style={{ borderColor: colors.border + '15' }}>
                      {item.status === 'active' && (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              Vibration.vibrate(15);
                              navigation.navigate('Main', {
                                screen: 'Kasir',
                                params: { loadEstimate: item, mode: 'convert' }
                              });
                            }}
                            className="flex-1 min-w-[45%] py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-row items-center justify-center gap-1.5"
                          >
                            <CreditCard size={12} color="#10b981" />
                            <Text className="text-[9px] font-black uppercase text-emerald-500 tracking-wider">Proses POS</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Vibration.vibrate(15);
                              navigation.navigate('Main', {
                                screen: 'Kasir',
                                params: { loadEstimate: item, mode: 'edit' }
                              });
                            }}
                            className="flex-1 min-w-[45%] py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex-row items-center justify-center gap-1.5"
                          >
                            <Edit2 size={12} color="#d97706" />
                            <Text className="text-[9px] font-black uppercase text-amber-600 tracking-wider">Edit</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => handlePrintA4(item)}
                        className="flex-1 min-w-[45%] py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-row items-center justify-center gap-1.5"
                      >
                        <FileText size={12} color="#3b82f6" />
                        <Text className="text-[9px] font-black uppercase text-blue-600 tracking-wider">Cetak A4</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handlePrintThermal(item)}
                        className="flex-1 min-w-[45%] py-2.5 rounded-xl bg-slate-500/10 border border-slate-500/20 flex-row items-center justify-center gap-1.5"
                      >
                        <Printer size={12} color="#64748b" />
                        <Text className="text-[9px] font-black uppercase text-slate-600 tracking-wider">Thermal</Text>
                      </TouchableOpacity>
                      {item.status === 'active' && (
                        <TouchableOpacity
                          onPress={() => {
                            Vibration.vibrate(10);
                            Alert.alert('Batalkan Estimasi', 'Yakin ingin membatalkan estimasi ini?', [
                              { text: 'Tutup', style: 'cancel' },
                              { text: 'Batalkan', style: 'destructive', onPress: async () => {
                                try {
                                  await updateDoc(doc(db, 'estimations', item.id), { status: 'cancelled' });
                                } catch (err) {}
                              }}
                            ]);
                          }}
                          className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center justify-center gap-1.5 mt-1"
                        >
                          <X size={12} color="#f43f5e" />
                          <Text className="text-[9px] font-black uppercase text-rose-500 tracking-wider">Batalkan Estimasi</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          Vibration.vibrate(10);
                          handleDelete(item.id, 'estimasi');
                        }}
                        className="w-full py-2.5 rounded-xl flex-row items-center justify-center gap-1.5 mt-1"
                      >
                        <Trash2 size={12} color={colors.textMuted} />
                        <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>Hapus Permanen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="items-center py-20 opacity-30">
                  <Calculator color={colors.textMuted} size={48} />
                  <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada data estimasi</Text>
                </View>
              }
            />
          </View>
        );

      case 'piutang':
        const filteredDebts = debts.filter(d => {
          const matchesSearch = (d.customerName || '').toLowerCase().includes(search.toLowerCase()) || d.id?.toLowerCase().includes(search.toLowerCase());
          const matchesFilter = 
            debtFilter === 'all' ? true : 
            debtFilter === 'paid' ? d.paymentStatus === 'paid' : 
            (d.paymentStatus === 'unpaid' || d.paymentStatus === 'partially_paid');
          return matchesSearch && matchesFilter;
        });

        const totalUnpaid = debts
          .filter(d => d.paymentStatus !== 'paid')
          .reduce((acc, curr) => acc + (curr.total - (curr.paidAmount ?? curr.cashReceived ?? 0)), 0);

        const totalPaid = debts
          .filter(d => d.paymentStatus === 'paid')
          .reduce((acc, curr) => acc + curr.total, 0);

        return (
          <View className="flex-1">
            {/* Top Summaries */}
            <View className="flex-row gap-2 mb-4">
              <View className="flex-1 p-3.5 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Text className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Piutang Berjalan</Text>
                <Text className="text-sm font-black text-rose-500">Rp {totalUnpaid.toLocaleString('id-ID')}</Text>
              </View>
              <View className="flex-1 p-3.5 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Text className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Lunas</Text>
                <Text className="text-sm font-black text-emerald-500">Rp {totalPaid.toLocaleString('id-ID')}</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-4">
              {(['all', 'unpaid', 'paid'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setDebtFilter(f)}
                  activeOpacity={0.8}
                  className="flex-1 py-3 rounded-xl items-center justify-center"
                  style={{ backgroundColor: debtFilter === f ? colors.accent : 'transparent' }}
                >
                  <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: debtFilter === f ? '#ffffff' : colors.text }}>
                    {f === 'all' ? 'Semua' : f === 'unpaid' ? 'Belum Lunas' : 'Lunas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={filteredDebts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const currentPaid = item.paidAmount ?? item.cashReceived ?? 0;
                const remaining = item.total - currentPaid;
                const isOverdue = item.dueDate && new Date(item.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && item.paymentStatus !== 'paid';

                return (
                  <View className="p-4 rounded-2xl border mb-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <View className="flex-row justify-between items-start mb-2.5">
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-black" style={{ color: colors.text }}>{item.customerName || 'Pelanggan Anonim'}</Text>
                        <Text className="text-[8px] font-mono text-slate-400 uppercase mt-0.5 tracking-tighter">ID: {item.id.substring(0, 10)}</Text>
                      </View>
                      <View className={`px-2 py-0.5 rounded border ${
                        item.paymentStatus === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20' :
                        item.paymentStatus === 'partially_paid' ? 'bg-amber-500/10 border-amber-500/20' :
                        'bg-rose-500/10 border-rose-500/20'
                      }`}>
                        <Text className={`text-[8px] font-black uppercase ${
                          item.paymentStatus === 'paid' ? 'text-emerald-500' :
                          item.paymentStatus === 'partially_paid' ? 'text-amber-500' :
                          'text-rose-500'
                        }`}>
                          {item.paymentStatus === 'paid' ? 'Lunas' : item.paymentStatus === 'partially_paid' ? 'Cicil' : 'Belum Lunas'}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center py-2 bg-black/10 rounded-xl px-3.5 mb-2.5">
                      <View>
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Belanja</Text>
                        <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {item.total.toLocaleString('id-ID')}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Sisa Tagihan</Text>
                        <Text className="text-xs font-black text-rose-500">Rp {remaining.toLocaleString('id-ID')}</Text>
                      </View>
                    </View>

                    {item.dueDate && item.paymentStatus !== 'paid' && (
                      <View className="flex-row items-center gap-1 mb-3">
                        <CalendarRange size={12} color={isOverdue ? "#f43f5e" : colors.textMuted} />
                        <Text className="text-[9px] font-bold" style={{ color: isOverdue ? "#f43f5e" : colors.textMuted }}>
                          Jatuh Tempo: {new Date(item.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                        {isOverdue && (
                          <View className="bg-rose-500 px-1 rounded ml-1">
                            <Text className="text-[7px] font-black text-white">OVERDUE</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View className="flex-row gap-2 mt-2">
                      <TouchableOpacity
                        onPress={() => {
                          Vibration.vibrate(10);
                          setSelectedDebt(item);
                          setDebtPaymentAmount(remaining > 0 ? remaining.toString() : '0');
                        }}
                        activeOpacity={0.8}
                        className="flex-1 py-3 rounded-xl border flex-row items-center justify-center gap-1"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                      >
                        <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.text }}>Rincian & Cicilan</Text>
                        <ChevronRight size={12} color={colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          Vibration.vibrate(10);
                          handleShareSignatureLink('deb', item.id);
                        }}
                        activeOpacity={0.8}
                        className="flex-1 py-3 rounded-xl border flex-row items-center justify-center gap-1.5"
                        style={{ backgroundColor: colors.accent + '10', borderColor: colors.accent + '20' }}
                      >
                        <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.accent }}>Bagikan Link TTD</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="items-center py-20 opacity-30">
                  <CreditCard color={colors.textMuted} size={48} />
                  <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada catatan piutang</Text>
                </View>
              }
            />
          </View>
        );

      case 'gudang':
        const filteredGudang = warehouses.filter((p: any) => 
          p.name.toLowerCase().includes(search.toLowerCase()) || 
          (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
        );
        return (
          <FlatList
            data={filteredGudang}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View className="p-4 rounded-2xl border mb-3 flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-black" style={{ color: colors.text }}>{item.name}</Text>
                  <Text className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">
                    SKU: {item.sku || '-'} • Kategori: {item.category || 'Umum'}
                  </Text>
                </View>
                <View className="items-end gap-2">
                  <View className="flex-row items-baseline">
                    <Text className="text-lg font-black text-emerald-500">{item.stock ?? 0}</Text>
                    <Text className="text-[10px] font-black uppercase text-slate-400 ml-1">{item.unit || 'pcs'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(10);
                      setSelectedProduct(item);
                      setMutationType('masuk');
                      setMutationQty('');
                      setMutationNote('');
                      setIsAdjustModalVisible(true);
                    }}
                    activeOpacity={0.8}
                    className="px-3 py-1.5 rounded-xl border flex-row items-center gap-1.5"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                  >
                    <ArrowDownLeft size={12} color={colors.accent} />
                    <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: colors.accent }}>Opname</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <Package color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Tidak ada produk dengan stok terkelola</Text>
              </View>
            }
          />
        );

      case 'ekstra':
        return (
          <FlatList
            data={extras.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View className="p-5 rounded-3xl border mb-3 flex gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-4">
                    <Text className="text-sm font-black" style={{ color: colors.text }}>{item.name}</Text>
                    <Text className="text-[10px] font-bold text-slate-400 mt-1 italic">
                      {item.options?.map((o: any) => `${o.name} (+Rp${o.price.toLocaleString('id-ID')})`).join(', ')}
                    </Text>
                  </View>
                  <View className={`px-2.5 py-0.5 rounded-lg border ${item.isActive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20'}`}>
                    <Text className={`text-[8px] font-black uppercase ${item.isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {item.isActive ? 'Aktif' : 'Off'}
                    </Text>
                  </View>
                </View>

                {/* Badges */}
                <View className="flex-row flex-wrap gap-1.5 mt-1">
                  {item.isMandatory && (
                    <View className="bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                      <Text className="text-[8px] font-black text-rose-500 uppercase tracking-wider">Wajib</Text>
                    </View>
                  )}
                  {item.allowMultiple ? (
                    <View className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                      <Text className="text-[8px] font-black text-indigo-500 uppercase tracking-wider">Multiple</Text>
                    </View>
                  ) : (
                    <View className="bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-md">
                      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Single</Text>
                    </View>
                  )}
                  {item.hasMaxLimit && (
                    <View className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                      <Text className="text-[8px] font-black text-amber-500 uppercase tracking-wider">Max {item.maxLimit}</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-2 mt-2 pt-3 border-t" style={{ borderColor: colors.border + '20' }}>
                  <TouchableOpacity
                    onPress={() => openFormModal(item)}
                    className="flex-1 py-2.5 rounded-xl border flex-row items-center justify-center gap-1.5"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                  >
                    <Edit2 size={12} color={colors.textMuted} />
                    <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, 'ekstra')}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} color="#f43f5e" />
                    <Text className="text-[10px] font-black uppercase tracking-wider text-rose-500">Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <PlusCircle color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada produk ekstra</Text>
              </View>
            }
          />
        );

      case 'diskon':
        return (
          <FlatList
            data={discounts.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const getStatus = (disc: any) => {
                if (!disc.isActive) return { label: 'Nonaktif', color: '#64748b', bg: '#64748b15', border: '#64748b30' };
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const start = new Date(disc.startDate);
                const end = disc.endDate ? new Date(disc.endDate) : null;

                if (start > today) return { label: 'Mendatang', color: '#3b82f6', bg: '#3b82f615', border: '#3b82f630' };
                if (end && end < today) return { label: 'Kadaluwarsa', color: '#f43f5e', bg: '#f43f5e15', border: '#f43f5e30' };
                return { label: 'Aktif', color: '#10b981', bg: '#10b98115', border: '#10b98130' };
              };

              const status = getStatus(item);
              const formattedPeriod = `${new Date(item.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - ${item.endDate ? new Date(item.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Infinit'}`;

              return (
                <View className="p-4 rounded-2xl border mb-3 flex gap-3.5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-black" style={{ color: colors.text }}>{item.name}</Text>
                      <Text className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        Periode: {formattedPeriod} • Target: {item.appliedProductIds?.length || 0} barang
                      </Text>
                    </View>
                    <View className="px-2 py-0.5 rounded-lg border" style={{ backgroundColor: status.bg, borderColor: status.border }}>
                      <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: status.color }}>
                        {status.label}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-baseline gap-1">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400">Potongan:</Text>
                    <Text className="text-base font-black" style={{ color: colors.accent }}>
                      {item.type === 'percent' ? `${item.value}%` : `Rp ${item.value.toLocaleString('id-ID')}`}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View className="flex-row gap-2 pt-3 border-t" style={{ borderColor: colors.border + '15' }}>
                    <TouchableOpacity
                      onPress={() => openFormModal(item)}
                      className="flex-1 py-2 rounded-xl border flex-row items-center justify-center gap-1.5"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                    >
                      <Edit2 size={12} color={colors.textMuted} />
                      <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(item.id, 'diskon')}
                      className="flex-1 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} color="#f43f5e" />
                      <Text className="text-[10px] font-black uppercase tracking-wider text-rose-500">Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <Tag color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada kupon diskon</Text>
              </View>
            }
          />
        );

      case 'terjual':
        const totalSoldQty = salesSummary.reduce((sum, item) => sum + item.qty, 0);
        const bestSeller = salesSummary[0]?.name || '-';
        const bestSellerQty = salesSummary[0]?.qty || 0;
        
        const currentYearNum = new Date().getFullYear();
        const yearsArray = Array.from({length: 5}, (_, i) => (currentYearNum - i).toString());

        const handleResetSold = () => {
          Alert.alert(
            'Reset Analitik Terjual?',
            'Aksi ini akan mengatur ulang penghitungan barang terjual mulai dari detik ini. Data Transaksi asli Anda TIDAK akan terhapus.',
            [
              { text: 'Batal', style: 'cancel' },
              { text: 'Ya, Reset', style: 'destructive', onPress: async () => {
                if (!storeId) return;
                setIsResettingSold(true);
                try {
                  const now = new Date();
                  await updateDoc(doc(db, 'settings', `store_${storeId}`), {
                    salesAnalyticsClearedAt: now
                  });
                  setSalesAnalyticsClearedAt(now);
                  Alert.alert('Berhasil', 'Analitik terjual telah direset.');
                } catch (e) {
                  Alert.alert('Gagal', 'Terjadi kesalahan saat mereset analitik.');
                } finally {
                  setIsResettingSold(false);
                }
              }}
            ]
          );
        };

        return (
          <View className="flex-1">
            {/* Filters */}
            <View className="flex-row items-center gap-2 mb-4">
              <View className="flex-1 flex-row border rounded-xl overflow-hidden" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                <View className="flex-1 border-r" style={{ borderColor: colors.border }}>
                  <Text className="absolute top-1.5 left-3 text-[8px] font-black uppercase text-slate-400 z-10">Bulan</Text>
                  <TextInput
                    value={soldMonthFilter}
                    onChangeText={setSoldMonthFilter}
                    style={{ display: 'none' }}
                  />
                  {/* Since native picker might be complex without external lib, we'll use a simple approach or horizontal scroll */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-4 px-2 mt-2">
                    <TouchableOpacity onPress={() => setSoldMonthFilter('all')} className={`px-3 py-1 rounded-lg mr-2 ${soldMonthFilter === 'all' ? 'bg-accent' : 'bg-background'}`}>
                      <Text className={`text-[10px] font-bold ${soldMonthFilter === 'all' ? 'text-white' : ''}`} style={{ color: soldMonthFilter === 'all' ? '#fff' : colors.text }}>Semua</Text>
                    </TouchableOpacity>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'].map((m, i) => (
                      <TouchableOpacity key={i} onPress={() => setSoldMonthFilter(i.toString())} className={`px-3 py-1 rounded-lg mr-2 ${soldMonthFilter === i.toString() ? 'bg-accent' : 'bg-background'}`}>
                        <Text className={`text-[10px] font-bold ${soldMonthFilter === i.toString() ? 'text-white' : ''}`} style={{ color: soldMonthFilter === i.toString() ? '#fff' : colors.text }}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View className="w-20 items-center justify-center pt-2">
                  <Text className="absolute top-1.5 left-2 text-[8px] font-black uppercase text-slate-400 z-10">Tahun</Text>
                  <Text className="font-bold text-xs" style={{ color: colors.text }}>{soldYearFilter}</Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={handleResetSold}
                disabled={isResettingSold}
                className="w-12 h-12 rounded-xl items-center justify-center bg-rose-500/10 border border-rose-500/20"
              >
                {isResettingSold ? <Activity size={16} color="#f43f5e" /> : <Trash2 size={20} color="#f43f5e" />}
              </TouchableOpacity>
            </View>

            {/* Summary Cards */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1 p-5 rounded-3xl border shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="p-2.5 bg-accent/10 self-start rounded-xl mb-3">
                  <Package size={20} color={colors.accent} />
                </View>
                <Text className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Total Unit Keluar</Text>
                <Text className="text-2xl font-black" style={{ color: colors.text }}>{totalSoldQty.toLocaleString('id-ID')} <Text className="text-xs font-bold text-slate-400">pcs</Text></Text>
              </View>
              <View className="flex-1 p-5 rounded-3xl border shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="p-2.5 bg-blue-500/10 self-start rounded-xl mb-3">
                  <Activity size={20} color="#3b82f6" />
                </View>
                <Text className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Katalog Teraktif</Text>
                <Text className="text-2xl font-black" style={{ color: colors.text }}>{salesSummary.length} <Text className="text-xs font-bold text-slate-400">Varian</Text></Text>
              </View>
            </View>

            {/* Top Seller Podium */}
            {bestSellerQty > 0 && (
              <View className="p-5 rounded-[2rem] border mb-5 flex-row items-center justify-between shadow-sm bg-gradient-to-br from-emerald-500/10 to-transparent" style={{ borderColor: '#10b98130' }}>
                <View className="flex-1 pr-4">
                  <View className="flex-row items-center gap-2 mb-2">
                    <TrendingUp size={16} color="#10b981" />
                    <Text className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Varian Terlaris</Text>
                  </View>
                  <Text className="text-xl font-black" style={{ color: colors.text }}>{bestSeller}</Text>
                </View>
                <View className="bg-emerald-500 shadow-md shadow-emerald-500/30 px-4 py-3 rounded-2xl">
                  <Text className="text-xl font-black text-white">{bestSellerQty}</Text>
                  <Text className="text-[8px] font-bold text-emerald-100 uppercase mt-0.5 tracking-wider">Terjual</Text>
                </View>
              </View>
            )}

            <View className="flex-row items-center justify-between mb-3 px-1">
              <Text className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Daftar Lengkap</Text>
            </View>

            <FlatList
              data={salesSummary}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => {
                const colorSets = [
                  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
                  { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-500' },
                  { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
                  { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-500' },
                  { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-500' },
                  { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-500' },
                  { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-500' }
                ];
                const theme = colorSets[index % colorSets.length];

                return (
                  <View className="p-4 rounded-3xl border mb-3 flex-row justify-between items-center group shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <View className="flex-row items-center gap-4 flex-1 pr-2">
                      <View className={`w-10 h-10 rounded-xl items-center justify-center border ${theme.bg} ${theme.border}`}>
                        <Text className={`font-black text-sm ${theme.text}`}>{index + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-black mb-1" style={{ color: colors.text }} numberOfLines={1}>{item.name}</Text>
                        <Text className="text-[10px] font-bold text-slate-400">Total Omzet: Rp {item.sales.toLocaleString('id-ID')}</Text>
                      </View>
                    </View>
                    <View className="items-end pl-3 border-l" style={{ borderColor: colors.border + '50' }}>
                      <Text className="text-lg font-black tracking-tighter" style={{ color: colors.accent }}>{item.qty}</Text>
                      <Text className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Terjual</Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="items-center py-20 opacity-30">
                  <Package color={colors.textMuted} size={64} />
                  <Text className="text-sm font-black mt-6 uppercase tracking-widest" style={{ color: colors.textMuted }}>Belum Ada Data</Text>
                  <Text className="text-[10px] font-bold mt-2" style={{ color: colors.textMuted }}>Ubah filter atau tunggu transaksi baru</Text>
                </View>
              }
            />
          </View>
        );

      case 'stok':
        return (
          <FlatList
            data={stockLogs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const ts = item.timestamp;
              let dateStr = 'Baru saja';
              if (ts) {
                const dateObj = ts.toDate ? ts.toDate() : new Date(ts);
                dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + 
                  ' ' + dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
              }
              const typeColor = item.type === 'masuk' ? '#10b981' : item.type === 'keluar' ? '#f43f5e' : colors.accent;
              const typeBg = item.type === 'masuk' ? '#10b98115' : item.type === 'keluar' ? '#f43f5e15' : colors.accent + '15';
              const typeBorder = item.type === 'masuk' ? '#10b98130' : item.type === 'keluar' ? '#f43f5e30' : colors.accent + '30';
              const symbol = item.type === 'masuk' ? '+' : item.type === 'keluar' ? '-' : '=';

              return (
                <View className="p-4 rounded-2xl border mb-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-start gap-2 mb-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-black" style={{ color: colors.text }}>{item.productName}</Text>
                      <Text className="text-[9px] font-bold text-slate-400 mt-0.5">
                        Oleh: {item.userEmail?.split('@')[0] || 'unknown'} • {dateStr}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-black text-base tracking-tighter" style={{ color: typeColor }}>
                        {symbol} {item.qty}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between pt-2 border-t" style={{ borderColor: colors.border + '15' }}>
                    <View className="px-2 py-0.5 rounded-lg border" style={{ backgroundColor: typeBg, borderColor: typeBorder }}>
                      <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: typeColor }}>
                        {item.type}
                      </Text>
                    </View>
                    <Text className="text-[9px] font-bold text-slate-400 italic max-w-[70%] truncate">
                      {item.note || '-'}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <History color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada mutasi stok terdaftar</Text>
              </View>
            }
          />
        );

      case 'expired':
        const getLoss = (p: any) => (p.qty || p.stock || 0) * (p.purchasePrice || 0);

        const expiredStats = {
          expired: {
            count: expiredItems.filter(p => p.daysLeft < 0).length,
            loss: expiredItems.filter(p => p.daysLeft < 0).reduce((acc, p) => acc + getLoss(p), 0)
          },
          near: {
            count: expiredItems.filter(p => p.daysLeft >= 0 && p.daysLeft <= 14).length,
            loss: expiredItems.filter(p => p.daysLeft >= 0 && p.daysLeft <= 14).reduce((acc, p) => acc + getLoss(p), 0)
          },
          safe: {
            count: expiredItems.filter(p => p.daysLeft > 14).length,
            loss: expiredItems.filter(p => p.daysLeft > 14).reduce((acc, p) => acc + getLoss(p), 0)
          }
        };

        const filteredExpired = expiredItems.filter(p => {
          if (expiredTab === 'expired') return p.daysLeft < 0;
          if (expiredTab === 'near') return p.daysLeft >= 0 && p.daysLeft <= 14;
          if (expiredTab === 'safe') return p.daysLeft > 14;
          return true;
        });

        return (
          <View className="flex-1">
            {/* Expiry Tabs */}
            <View className="flex-row gap-2 mb-4 p-1 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <TouchableOpacity
                onPress={() => setExpiredTab('expired')}
                activeOpacity={0.8}
                className="flex-1 py-2.5 rounded-xl items-center justify-center"
                style={{ backgroundColor: expiredTab === 'expired' ? '#f43f5e' : 'transparent' }}
              >
                <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: expiredTab === 'expired' ? '#ffffff' : colors.text }}>
                  Expired ({expiredStats.expired.count})
                </Text>
                <Text className="text-[8px] font-bold" style={{ color: expiredTab === 'expired' ? '#ffffffcc' : colors.textMuted }}>
                  Rp {expiredStats.expired.loss.toLocaleString('id-ID')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setExpiredTab('near')}
                activeOpacity={0.8}
                className="flex-1 py-2.5 rounded-xl items-center justify-center"
                style={{ backgroundColor: expiredTab === 'near' ? '#f59e0b' : 'transparent' }}
              >
                <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: expiredTab === 'near' ? '#ffffff' : colors.text }}>
                  Mendekati ({expiredStats.near.count})
                </Text>
                <Text className="text-[8px] font-bold" style={{ color: expiredTab === 'near' ? '#ffffffcc' : colors.textMuted }}>
                  Rp {expiredStats.near.loss.toLocaleString('id-ID')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setExpiredTab('safe')}
                activeOpacity={0.8}
                className="flex-1 py-2.5 rounded-xl items-center justify-center"
                style={{ backgroundColor: expiredTab === 'safe' ? '#10b981' : 'transparent' }}
              >
                <Text className="text-[9px] font-black uppercase tracking-wider" style={{ color: expiredTab === 'safe' ? '#ffffff' : colors.text }}>
                  Layak ({expiredStats.safe.count})
                </Text>
                <Text className="text-[8px] font-bold" style={{ color: expiredTab === 'safe' ? '#ffffffcc' : colors.textMuted }}>
                  Rp {expiredStats.safe.loss.toLocaleString('id-ID')}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredExpired}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const diff = item.daysLeft;
                const loss = getLoss(item);
                const diffColor = diff < 0 ? '#f43f5e' : diff <= 14 ? '#f59e0b' : '#10b981';
                const diffBg = diff < 0 ? '#f43f5e15' : diff <= 14 ? '#f59e0b15' : '#10b98115';
                const diffBorder = diff < 0 ? '#f43f5e30' : diff <= 14 ? '#f59e0b30' : '#10b98130';

                return (
                  <View className="p-4 rounded-2xl border mb-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <View className="flex-row justify-between items-start gap-2 mb-2">
                      <View className="flex-1">
                        <Text className="text-sm font-black" style={{ color: colors.text }}>{item.name}</Text>
                        <Text className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-widest">
                          SKU: {item.sku || '-'} • Stok: {item.qty} pcs
                        </Text>
                      </View>
                      <View className="px-2 py-0.5 rounded-lg border" style={{ backgroundColor: diffBg, borderColor: diffBorder }}>
                        <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: diffColor }}>
                          {diff < 0 ? `LEWAT ${Math.abs(diff)} HR` : diff === 0 ? 'EXPIRED HARI INI' : `${diff} HR LAGI`}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center pt-2 border-t" style={{ borderColor: colors.border + '15' }}>
                      <View>
                        <Text className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Tanggal Expired</Text>
                        <Text className="text-[10px] font-bold" style={{ color: colors.text }}>
                          {new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[8px] font-black uppercase text-rose-500/60 tracking-wider">Potensi Rugi</Text>
                        <Text className="text-xs font-black text-rose-500">
                          Rp {loss.toLocaleString('id-ID')}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="items-center py-20 opacity-30">
                  <CalendarRange color={colors.textMuted} size={48} />
                  <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Tidak ada produk di kategori ini</Text>
                </View>
              }
            />

            {/* Bottom Total Loss Summary */}
            {filteredExpired.length > 0 && (
              <View className="p-4 rounded-2xl border-t mb-2 flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row items-center gap-2">
                  <TrendingUp size={16} color="#f43f5e" />
                  <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>Total Potensi Kerugian</Text>
                </View>
                <Text className="text-sm font-black text-rose-500">
                  Rp {filteredExpired.reduce((acc, p) => acc + getLoss(p), 0).toLocaleString('id-ID')}
                </Text>
              </View>
            )}
          </View>
        );

      case 'lap_penjualan':
        const salesNow = new Date();
        let salesStartDate: Date | null = null;

        if (salesDateRange === 'today') {
          salesStartDate = new Date();
          salesStartDate.setHours(0, 0, 0, 0);
        } else if (salesDateRange === '7days') {
          salesStartDate = new Date();
          salesStartDate.setDate(salesNow.getDate() - 7);
          salesStartDate.setHours(0, 0, 0, 0);
        } else if (salesDateRange === '30days') {
          salesStartDate = new Date();
          salesStartDate.setDate(salesNow.getDate() - 30);
          salesStartDate.setHours(0, 0, 0, 0);
        } else if (salesDateRange === 'custom') {
          if (salesCustomStartDate) {
            salesStartDate = new Date(salesCustomStartDate);
            salesStartDate.setHours(0, 0, 0, 0);
          }
        }

        let filteredSalesTrx = [...salesTransactions];

        if (salesStartDate) {
          filteredSalesTrx = filteredSalesTrx.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date());
            return itemDate >= salesStartDate!;
          });
        }

        if (salesDateRange === 'custom' && salesCustomEndDate) {
          const endDate = new Date(salesCustomEndDate);
          endDate.setHours(23, 59, 59, 999);
          filteredSalesTrx = filteredSalesTrx.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date());
            return itemDate <= endDate;
          });
        }

        // Metrics calculations
        let totalOmzet = 0;
        let totalProfit = 0;
        let totalProdukTerjual = 0;
        
        let transaksiLunasCount = 0;
        let nominalLunas = 0;
        
        let transaksiPiutangCount = 0;
        let totalPiutangAwal = 0;
        let totalPiutangTerbayar = 0;
        let totalSisaPiutang = 0;

        const mobileProductsMap = allProducts.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        filteredSalesTrx.forEach(trx => {
          const isDebt = trx.paymentCategory === 'debt';
          const dp = (isDebt && trx.paymentHistory && trx.paymentHistory.length > 0 && trx.paymentHistory[0].note?.includes('DP')) 
            ? (trx.paymentHistory[0].amount || 0) 
            : 0;

          // 1. Piutang metrics
          if (isDebt) {
            transaksiPiutangCount++;
            const piutangAwal = Math.max(0, (trx.total || 0) - dp);
            const paid = trx.paidAmount || 0;
            const piutangTerbayar = Math.max(0, paid - dp);
            const sisaPiutang = trx.debtAmount !== undefined ? trx.debtAmount : Math.max(0, (trx.total || 0) - paid);
            
            totalPiutangAwal += piutangAwal;
            totalPiutangTerbayar += piutangTerbayar;
            totalSisaPiutang += sisaPiutang;
          }

          // 2. Lunas metrics
          if (trx.paymentStatus === 'paid') {
            transaksiLunasCount++;
            nominalLunas += trx.total || 0;
          }

          // 3. Omzet
          totalOmzet += trx.total || 0;

          // 4. Qty & Profit
          let trxHpp = 0;
          if (trx.items && Array.isArray(trx.items)) {
            trx.items.forEach((item: any) => {
              totalProdukTerjual += item.qty || 0;
              const pPrice = item.purchasePrice !== undefined 
                ? item.purchasePrice 
                : (mobileProductsMap[item.productId]?.purchasePrice || 0);
              trxHpp += pPrice * (item.qty || 0);
            });
          }
          const trxSubtotal = trx.subtotal !== undefined ? trx.subtotal : ((trx.total || 0) - (trx.tax || 0));
          totalProfit += (trxSubtotal - trxHpp);
        });

        return (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Filter Periode */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-3">
              {(['today', '7days', '30days', 'custom'] as const).map(preset => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setSalesDateRange(preset);
                  }}
                  activeOpacity={0.8}
                  className="flex-1 py-2.5 rounded-xl items-center justify-center"
                  style={{ backgroundColor: salesDateRange === preset ? colors.accent : 'transparent' }}
                >
                  <Text className="text-[9px] font-black uppercase tracking-wide" style={{ color: salesDateRange === preset ? '#ffffff' : colors.text }}>
                    {preset === 'today' ? 'Hari Ini' : preset === '7days' ? '7 Hari' : preset === '30days' ? '30 Hari' : 'Kustom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Dates Inputs */}
            {salesDateRange === 'custom' && (
              <View className="flex-row gap-2 mb-3.5 p-3 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-1">
                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Dari (YYYY-MM-DD)</Text>
                  <TextInput
                    placeholder="2026-05-01"
                    placeholderTextColor={colors.textMuted}
                    value={salesCustomStartDate}
                    onChangeText={setSalesCustomStartDate}
                    className="p-2.5 rounded-xl border text-xs font-bold text-center"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Sampai (YYYY-MM-DD)</Text>
                  <TextInput
                    placeholder="2026-05-30"
                    placeholderTextColor={colors.textMuted}
                    value={salesCustomEndDate}
                    onChangeText={setSalesCustomEndDate}
                    className="p-2.5 rounded-xl border text-xs font-bold text-center"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>
              </View>
            )}

            {/* Grid 8 Kartu Ringkasan Penjualan */}
            <View className="flex-row flex-wrap justify-between mt-2 mb-4">
               {/* Card 1: Omzet */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <TrendingUp size={14} color="#34d399" />
                   <Text className="text-[8px] font-black uppercase text-emerald-400">OMZET (KOTOR)</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {totalOmzet.toLocaleString('id-ID')}</Text>
               </View>

               {/* Card 2: Profit */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <Coins size={14} color="#a78bfa" />
                   <Text className="text-[8px] font-black uppercase text-violet-400">PROFIT (LABA)</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {totalProfit.toLocaleString('id-ID')}</Text>
               </View>

               {/* Card 3: Produk Terjual */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <Package size={14} color="#38bdf8" />
                   <Text className="text-[8px] font-black uppercase text-sky-400">PRODUK TERJUAL</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>{totalProdukTerjual} Qty</Text>
               </View>

               {/* Card 4: Transaksi Lunas */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <CheckCircle size={14} color="#2dd4bf" />
                   <Text className="text-[8px] font-black uppercase text-teal-400">TRANSAKSI LUNAS</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>{transaksiLunasCount} Trx</Text>
                 <Text className="text-[8px] mt-0.5 font-bold" style={{ color: colors.textMuted }}>Rp {nominalLunas.toLocaleString('id-ID')}</Text>
               </View>

               {/* Card 5: Transaksi Piutang */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <CreditCard size={14} color="#fbbf24" />
                   <Text className="text-[8px] font-black uppercase text-amber-400">TRANSAKSI PIUTANG</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>{transaksiPiutangCount} Trx</Text>
               </View>

               {/* Card 6: Piutang Awal */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <ArrowUpCircle size={14} color="#fb7185" />
                   <Text className="text-[8px] font-black uppercase text-rose-400">PIUTANG AWAL</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {totalPiutangAwal.toLocaleString('id-ID')}</Text>
               </View>

               {/* Card 7: Piutang Terbayar */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <ArrowUpCircle size={14} color="#34d399" />
                   <Text className="text-[8px] font-black uppercase text-emerald-400">PIUTANG TERBAYAR</Text>
                 </View>
                 <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {totalPiutangTerbayar.toLocaleString('id-ID')}</Text>
               </View>

               {/* Card 8: Sisa Piutang */}
               <View className="p-4 rounded-2xl border mb-3 w-[48%]" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                 <View className="flex-row items-center gap-1.5 mb-1">
                   <AlertTriangle size={14} color="#f43f5e" />
                   <Text className="text-[8px] font-black uppercase text-rose-500">SISA PIUTANG</Text>
                 </View>
                 <Text className="text-xs font-black text-rose-500">Rp {totalSisaPiutang.toLocaleString('id-ID')}</Text>
               </View>
            </View>
          </ScrollView>
        );

      case 'lap_omzet':
        return (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Period Type Selector */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-4">
              {(['weekly', 'monthly', 'yearly'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setOmzetPeriodType(type);
                  }}
                  activeOpacity={0.8}
                  className="flex-1 py-2.5 rounded-xl items-center justify-center"
                  style={{ backgroundColor: omzetPeriodType === type ? colors.accent : 'transparent' }}
                >
                  <Text className="text-[10px] font-black uppercase tracking-wide" style={{ color: omzetPeriodType === type ? '#ffffff' : colors.text }}>
                    {type === 'weekly' ? 'Mingguan' : type === 'monthly' ? 'Bulanan' : 'Tahunan'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Year Selector (Only for Bulanan period) */}
            {omzetPeriodType === 'monthly' && omzetAvailableYears.length > 0 && (
              <View className="mb-4">
                <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Filter Tahun</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(10);
                      setOmzetYearFilter('Semua');
                    }}
                    className="px-4 py-2 rounded-xl border mr-2"
                    style={{
                      backgroundColor: omzetYearFilter === 'Semua' ? colors.accent : colors.surface,
                      borderColor: omzetYearFilter === 'Semua' ? colors.accent : colors.border
                    }}
                  >
                    <Text className="text-[10px] font-black" style={{ color: omzetYearFilter === 'Semua' ? '#ffffff' : colors.text }}>Semua</Text>
                  </TouchableOpacity>
                  {omzetAvailableYears.map(year => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => {
                        Vibration.vibrate(10);
                        setOmzetYearFilter(year);
                      }}
                      className="px-4 py-2 rounded-xl border mr-2"
                      style={{
                        backgroundColor: omzetYearFilter === year ? colors.accent : colors.surface,
                        borderColor: omzetYearFilter === year ? colors.accent : colors.border
                      }}
                    >
                      <Text className="text-[10px] font-black" style={{ color: omzetYearFilter === year ? '#ffffff' : colors.text }}>{year}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View className="p-6 rounded-[28px] border mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Perbandingan Omzet {omzetPeriodType === 'weekly' ? 'Mingguan' : omzetPeriodType === 'monthly' ? 'Bulanan' : 'Tahunan'}
              </Text>
              <Text className="text-3xl font-black text-emerald-400" style={{ color: colors.accent }}>
                {omzetPeriodType === 'weekly' ? 'Mingguan' : omzetPeriodType === 'monthly' ? (omzetYearFilter === 'Semua' ? 'Bulanan (Semua)' : `Bulanan (${omzetYearFilter})`) : 'Tahunan'}
              </Text>
              
              <View className="mt-6 flex gap-4">
                {omzetReportState.map((item, idx) => (
                  <View key={idx}>
                    <View className="flex-row justify-between mb-1.5">
                      <Text className="text-xs font-bold" style={{ color: item.active ? colors.text : colors.textMuted }}>{item.label}</Text>
                      <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {item.amount.toLocaleString('id-ID')}</Text>
                    </View>
                    <View className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
                      <View className="h-full bg-blue-500" style={{ width: `${item.pct}%`, backgroundColor: item.active ? colors.accent : colors.border }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        );

      case 'lap_terlaris':
        return (
          <FlatList
            data={salesSummary}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <View className="p-4 rounded-2xl border mb-3 flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-lg items-center justify-center bg-amber-500/10 border border-amber-500/30">
                    <Text className="font-black text-amber-500 text-xs">#{index + 1}</Text>
                  </View>
                  <View>
                    <Text className="text-sm font-black" style={{ color: colors.text }}>{item.name}</Text>
                    <Text className="text-[10px] font-bold text-slate-400 mt-1">Total terjual: {item.qty} pcs</Text>
                  </View>
                </View>
                <Text className="text-sm font-black text-emerald-400">Rp {item.sales.toLocaleString('id-ID')}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <Flame color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada histori penjualan</Text>
              </View>
            }
          />
        );

      case 'arus_kas':
        const now = new Date();
        let startDate: Date | null = null;

        if (cashFlowDateRange === 'today') {
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
        } else if (cashFlowDateRange === '7days') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
        } else if (cashFlowDateRange === '30days') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 30);
          startDate.setHours(0, 0, 0, 0);
        } else if (cashFlowDateRange === 'custom') {
          if (cashFlowCustomStartDate) {
            startDate = new Date(cashFlowCustomStartDate);
            startDate.setHours(0, 0, 0, 0);
          }
        }

        let filteredCF = [...cashflows];

        if (startDate) {
          filteredCF = filteredCF.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date());
            return itemDate >= startDate!;
          });
        }

        if (cashFlowDateRange === 'custom' && cashFlowCustomEndDate) {
          const endDate = new Date(cashFlowCustomEndDate);
          endDate.setHours(23, 59, 59, 999);
          filteredCF = filteredCF.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : new Date());
            return itemDate <= endDate;
          });
        }

        if (cashFlowTab === 'income') {
          filteredCF = filteredCF.filter(d => d.type === 'in');
        } else if (cashFlowTab === 'expense') {
          filteredCF = filteredCF.filter(d => d.type === 'out');
        }

        if (search) {
          const queryLower = search.toLowerCase();
          filteredCF = filteredCF.filter(d => 
            (d.description && d.description.toLowerCase().includes(queryLower)) || 
            (d.category && d.category.toLowerCase().includes(queryLower)) ||
            (d.userEmail && d.userEmail.toLowerCase().includes(queryLower))
          );
        }

        // Running balance math: Sort chronologically oldest first, run running math, reverse back
        filteredCF.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return timeA - timeB;
        });

        let runningBal = 0;
        let tInflow = 0;
        let tOutflow = 0;
        let cashInflow = 0;
        let bankInflow = 0;

        const processedCF = filteredCF.map(item => {
          if (item.type === 'in') {
            runningBal += item.amount;
            tInflow += item.amount;
            if (item.paymentMethod === 'cash' || !item.paymentMethod) cashInflow += item.amount;
            else bankInflow += item.amount;
          } else {
            runningBal -= item.amount;
            tOutflow += item.amount;
          }
          return { ...item, runningBalance: runningBal };
        });

        processedCF.reverse();

        return (
          <View className="flex-1">
            {/* Top Summaries Dashboard (Scrollable horizontally) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-row gap-2 max-h-[85px]">
              <View className="p-3.5 rounded-2xl border w-36 mr-2 bg-emerald-500/10 border-emerald-500/20">
                <Text className="text-[8px] font-black uppercase text-emerald-500 tracking-wider mb-1">Laci (Tunai)</Text>
                <Text className="text-xs font-black text-emerald-400" numberOfLines={1}>Rp {cashInflow.toLocaleString('id-ID')}</Text>
              </View>
              <View className="p-3.5 rounded-2xl border w-36 mr-2 bg-blue-500/10 border-blue-500/20">
                <Text className="text-[8px] font-black uppercase text-blue-500 tracking-wider mb-1">Bank & QRIS</Text>
                <Text className="text-xs font-black text-blue-400" numberOfLines={1}>Rp {bankInflow.toLocaleString('id-ID')}</Text>
              </View>
              <View className="p-3.5 rounded-2xl border w-36 mr-2 bg-rose-500/10 border-rose-500/20">
                <Text className="text-[8px] font-black uppercase text-rose-500 tracking-wider mb-1">Biaya & Keluar</Text>
                <Text className="text-xs font-black text-rose-400" numberOfLines={1}>Rp {tOutflow.toLocaleString('id-ID')}</Text>
              </View>
              <View className="p-3.5 rounded-2xl border w-36 bg-amber-500/10 border-amber-500/20">
                <Text className="text-[8px] font-black uppercase text-amber-500 tracking-wider mb-1">Laba Bersih Kas</Text>
                <Text className="text-xs font-black text-amber-400" numberOfLines={1}>Rp {(tInflow - tOutflow).toLocaleString('id-ID')}</Text>
              </View>
            </ScrollView>

            {/* Date Preset Filter */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-3">
              {(['today', '7days', '30days', 'custom'] as const).map(preset => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setCashFlowDateRange(preset)}
                  activeOpacity={0.8}
                  className="flex-1 py-2 rounded-xl items-center justify-center"
                  style={{ backgroundColor: cashFlowDateRange === preset ? colors.accent : 'transparent' }}
                >
                  <Text className="text-[9px] font-black uppercase tracking-wide" style={{ color: cashFlowDateRange === preset ? '#ffffff' : colors.text }}>
                    {preset === 'today' ? 'Hari Ini' : preset === '7days' ? '7 Hari' : preset === '30days' ? '30 Hari' : 'Kustom'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Dates Inputs */}
            {cashFlowDateRange === 'custom' && (
              <View className="flex-row gap-2 mb-3.5 p-3 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-1">
                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Dari (YYYY-MM-DD)</Text>
                  <TextInput
                    placeholder="2026-05-01"
                    placeholderTextColor={colors.textMuted}
                    value={cashFlowCustomStartDate}
                    onChangeText={setCashFlowCustomStartDate}
                    className="p-2.5 rounded-xl border text-xs font-bold text-center"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Sampai (YYYY-MM-DD)</Text>
                  <TextInput
                    placeholder="2026-05-30"
                    placeholderTextColor={colors.textMuted}
                    value={cashFlowCustomEndDate}
                    onChangeText={setCashFlowCustomEndDate}
                    className="p-2.5 rounded-xl border text-xs font-bold text-center"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>
              </View>
            )}

            {/* Tab Filter */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-4">
              {(['all', 'income', 'expense'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setCashFlowTab(tab)}
                  activeOpacity={0.8}
                  className="flex-1 py-2 rounded-xl items-center justify-center"
                  style={{ backgroundColor: cashFlowTab === tab ? colors.accent : 'transparent' }}
                >
                  <Text className="text-[9px] font-black uppercase tracking-wide" style={{ color: cashFlowTab === tab ? '#ffffff' : colors.text }}>
                    {tab === 'income' ? 'Pemasukan' : tab === 'expense' ? 'Pengeluaran' : 'Semua'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={processedCF}
              keyExtractor={(item, idx) => item.id + '-' + idx}
              renderItem={({ item }) => {
                const dateObj = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp ? new Date(item.timestamp) : null);
                const timeStr = dateObj ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '12:00';
                const dateStr = dateObj ? dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Baru';
                
                return (
                  <View className="p-4 rounded-2xl border mb-3 flex gap-2.5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <View className="flex-row justify-between items-center">
                      <View className="flex-row items-center gap-3">
                        <View className={`w-8 h-8 rounded-lg items-center justify-center ${item.type === 'in' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                          {item.type === 'in' ? <ArrowDownLeft size={16} color="#10b981" /> : <ArrowUpRight size={16} color="#f43f5e" />}
                        </View>
                        <View>
                          <Text className="text-xs font-black" style={{ color: colors.text }}>{item.description}</Text>
                          <Text className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{dateStr} • {timeStr} • {item.isManual ? 'MANUAL' : 'SISTEM POS'}</Text>
                        </View>
                      </View>
                      <Text className={`font-black text-xs ${item.type === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.type === 'in' ? '+' : '-'}Rp {item.amount.toLocaleString('id-ID')}
                      </Text>
                    </View>

                    <View className="flex-row justify-between items-center pt-2 border-t" style={{ borderColor: colors.border + '15' }}>
                      <View className="flex-row gap-2">
                        <View className="bg-black/5 px-2 py-0.5 rounded-md">
                          <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.category}</Text>
                        </View>
                        {item.paymentMethod && (
                          <View className="bg-accent/10 px-2 py-0.5 rounded-md">
                            <Text className="text-[8px] font-black text-accent uppercase tracking-widest">{item.paymentMethod}</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-[9px] font-bold text-slate-400">Saldo: Rp {item.runningBalance.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="items-center py-20 opacity-30">
                  <Coins color={colors.textMuted} size={48} />
                  <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada rekaman arus kas</Text>
                </View>
              }
            />
          </View>
        );

      case 'pelanggan':
        return (
          <FlatList
            data={customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View className="p-4 rounded-2xl border mb-3 flex gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-sm font-black" style={{ color: colors.text }}>{item.name}</Text>
                    <Text className="text-[10px] font-bold text-slate-400 mt-1">Telp: {item.phone} • Blanja: {item.orders}x</Text>
                  </View>
                  <View className="bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
                    <Text className="text-xs font-black text-indigo-400">{item.points} Poin</Text>
                  </View>
                </View>
                {/* Actions */}
                <View className="flex-row gap-2 pt-3 border-t" style={{ borderColor: colors.border + '15' }}>
                  <TouchableOpacity
                    onPress={() => openFormModal(item)}
                    className="flex-1 py-2 rounded-xl border flex-row items-center justify-center gap-1.5"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                  >
                    <Edit2 size={12} color={colors.textMuted} />
                    <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: colors.textMuted }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id, 'pelanggan')}
                    className="flex-1 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} color="#f43f5e" />
                    <Text className="text-[10px] font-black uppercase tracking-wider text-rose-500">Hapus</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <Users color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada pelanggan terdaftar</Text>
              </View>
            }
          />
        );

      case 'tutup_buku':
        return (
          <FlatList
            data={closingLogs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const sysCash = item.systemCalculatedCash ?? item.expected ?? 0;
              const actCash = item.actualCash ?? item.actual ?? 0;
              const difference = item.difference ?? (actCash - sysCash);
              const cashier = item.cashierName ?? item.closedBy ?? item.cashier ?? 'Kasir';
              const note = item.note || 'Sesi Tutup Buku';
              
              const dateObj = item.timestamp?.toDate ? item.timestamp.toDate() : (item.closedAt ? new Date(item.closedAt) : null);
              const timeStr = dateObj ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

              return (
                <View className="p-4 rounded-2xl border mb-3 flex gap-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-2">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">{timeStr}</Text>
                      <Text className="text-sm font-black" style={{ color: colors.text }}>Kasir: <Text style={{ color: colors.accent }}>{cashier.split('@')[0]}</Text></Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded border ${
                      difference === 0 ? 'bg-emerald-500/10 border-emerald-500/20' :
                      difference > 0 ? 'bg-blue-500/10 border-blue-500/20' :
                      'bg-rose-500/10 border-rose-500/20'
                    }`}>
                      <Text className={`text-[8px] font-black uppercase ${
                        difference === 0 ? 'text-emerald-500' :
                        difference > 0 ? 'text-blue-500' :
                        'text-rose-500'
                      }`}>
                        {difference === 0 ? 'Sesuai' : difference > 0 ? 'Surplus' : 'Selisih'}
                      </Text>
                    </View>
                  </View>

                  <View className="grid grid-cols-2 gap-2 flex-row">
                    <View className="flex-1 p-2.5 rounded-xl bg-black/10 border border-black/5">
                      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Saldo Sistem</Text>
                      <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {sysCash.toLocaleString('id-ID')}</Text>
                    </View>
                    <View className="flex-1 p-2.5 rounded-xl bg-black/10 border border-black/5">
                      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Uang Fisik</Text>
                      <Text className="text-xs font-black text-emerald-400">Rp {actCash.toLocaleString('id-ID')}</Text>
                    </View>
                  </View>

                  {difference !== 0 && (
                    <View className={`p-2.5 rounded-xl border flex-row items-center justify-between ${difference > 0 ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' : 'bg-rose-500/5 border-rose-500/10 text-rose-500'}`}>
                      <Text className="text-[8px] font-black uppercase tracking-widest" style={{ color: difference > 0 ? '#10b981' : '#f43f5e' }}>{difference > 0 ? 'Kelebihan Uang' : 'Kekurangan Uang'}</Text>
                      <Text className="text-xs font-black" style={{ color: difference > 0 ? '#10b981' : '#f43f5e' }}>Rp {Math.abs(difference).toLocaleString('id-ID')}</Text>
                    </View>
                  )}

                  {note !== '' && (
                    <View className="p-2.5 bg-black/5 rounded-xl">
                      <Text className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Catatan:</Text>
                      <Text className="text-[10px] font-bold text-slate-400 italic">"{note}"</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <Lock color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada riwayat tutup shift</Text>
              </View>
            }
          />
        );

      case 'shift':
        const otherActiveShifts = shifts.filter(s => s.status === 'open' && s.userId !== user?.uid);
        const closedShifts = shifts.filter(s => s.status === 'closed');
        
        return (
          <View className="flex-1">
            {/* Tab Selector */}
            <View className="flex-row gap-2 mb-4 p-1 rounded-2xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <TouchableOpacity
                onPress={() => setShiftTab('active')}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: shiftTab === 'active' ? colors.accent : 'transparent' }}
              >
                <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: shiftTab === 'active' ? '#ffffff' : colors.text }}>
                  Sesi Aktif
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShiftTab('history')}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: shiftTab === 'history' ? colors.accent : 'transparent' }}
              >
                <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: shiftTab === 'history' ? '#ffffff' : colors.text }}>
                  Riwayat Shift
                </Text>
              </TouchableOpacity>
            </View>

            {shiftTab === 'active' ? (
              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {myActiveShift ? (
                  <View className="p-5 rounded-3xl border mb-6" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <View className="flex-row justify-between items-center mb-4">
                      <View className="flex-row items-center gap-2.5">
                        <View className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center">
                          <CheckCircle size={16} color="#10b981" />
                        </View>
                        <View>
                          <Text className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Shift Anda Aktif</Text>
                          <Text className="text-sm font-black mt-0.5" style={{ color: colors.text }}>{myActiveShift.userName}</Text>
                        </View>
                      </View>
                      <View className="px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                        <Text className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Running</Text>
                      </View>
                    </View>

                    <Text className="text-[9px] font-bold text-slate-400 mb-4">
                      Mulai sejak: {(() => {
                        const startD = myActiveShift.startTime?.toDate ? myActiveShift.startTime.toDate() : (myActiveShift.startTime ? new Date(myActiveShift.startTime) : null);
                        return startD ? startD.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + startD.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                      })()}
                    </Text>

                    {/* Stats grid */}
                    <View className="flex-row flex-wrap mb-5">
                      <View className="w-[48%] p-3.5 rounded-2xl bg-black/10 border border-black/5 mb-3 mr-[4%]">
                        <View className="flex-row justify-between items-start mb-1">
                          <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Modal Awal</Text>
                          <TouchableOpacity 
                            onPress={() => {
                              setResetConfirmText('');
                              setIsResetShiftModalOpen(true);
                            }}
                            activeOpacity={0.7}
                            className="flex-row items-center gap-1"
                          >
                            <Trash2 size={10} color="#f43f5e" />
                            <Text className="text-[8px] font-black text-rose-500 uppercase">Reset</Text>
                          </TouchableOpacity>
                        </View>
                        <Text className="text-sm font-black" style={{ color: colors.text }}>Rp {myActiveShift.startingCash.toLocaleString('id-ID')}</Text>
                      </View>
                      
                      <View className="w-[48%] p-3.5 rounded-2xl bg-black/10 border border-black/5 mb-3">
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Penjualan Tunai</Text>
                        <Text className="text-sm font-black" style={{ color: colors.text }}>Rp {activeShiftStats.cashSales.toLocaleString('id-ID')}</Text>
                      </View>
                      
                      <View className="w-[48%] p-3.5 rounded-2xl bg-accent/10 border border-accent/20 mb-3 mr-[4%]">
                        <Text className="text-[8px] font-black text-accent uppercase tracking-widest mb-1">Estimasi Laci</Text>
                        <Text className="text-sm font-black" style={{ color: colors.accent }}>Rp {(myActiveShift.startingCash + activeShiftStats.cashSales).toLocaleString('id-ID')}</Text>
                      </View>
                      
                      <View className="w-[48%] p-3.5 rounded-2xl bg-black/10 border border-black/5 mb-3">
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Terproses</Text>
                        <Text className="text-sm font-black" style={{ color: colors.text }}>{activeShiftStats.trxCount} Order</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => setIsCloseShiftModalOpen(true)}
                      activeOpacity={0.8}
                      className="py-4 bg-rose-500 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg shadow-rose-500/20"
                    >
                      <Lock size={14} color="#ffffff" />
                      <Text className="text-xs font-black text-white uppercase tracking-widest">TUTUP SHIFT SEKARANG</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View className="p-5 rounded-3xl border mb-6" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                    <View className="flex-row items-center gap-3 mb-4">
                      <View className="w-10 h-10 rounded-2xl bg-amber-500/10 items-center justify-center">
                        <Lock size={20} color="#f59e0b" />
                      </View>
                      <View>
                        <Text className="text-sm font-black" style={{ color: colors.text }}>Shift Belum Dibuka</Text>
                        <Text className="text-[10px] font-bold text-slate-400 mt-0.5">Buka shift untuk mengakses kasir</Text>
                      </View>
                    </View>

                    <Text className="text-xs font-bold text-slate-400 mb-5 leading-relaxed">
                      Sebelum memulai penjualan di menu POS/Kasir, silakan buka sesi kerja Anda dengan memasukkan Modal Awal (laci kas).
                    </Text>

                    <View className="space-y-1.5 mb-5">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Modal Awal (Float Cash) Rp</Text>
                      <TextInput
                        placeholder="e.g. 100000"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={startingCash}
                        onChangeText={setStartingCash}
                        className="px-4 py-3 rounded-2xl border font-bold text-xs"
                        style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={handleStartShiftMobile}
                      disabled={isShiftProcessing}
                      activeOpacity={0.8}
                      className="py-4 bg-emerald-500 rounded-2xl items-center justify-center flex-row gap-2"
                    >
                      {isShiftProcessing ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Play size={14} color="#ffffff" />
                          <Text className="text-xs font-black text-white uppercase tracking-widest">BUKA SHIFT SEKARANG</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Other Active Shifts */}
                {otherActiveShifts.length > 0 && (
                  <View className="mb-6">
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Shift Aktif Karyawan Lain</Text>
                    {otherActiveShifts.map(s => {
                      const startD = s.startTime?.toDate ? s.startTime.toDate() : (s.startTime ? new Date(s.startTime) : null);
                      const timeStr = startD ? startD.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                      return (
                        <View key={s.id} className="p-4 rounded-2xl border mb-3 flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                          <View className="flex-1 pr-2">
                            <Text className="text-xs font-black" style={{ color: colors.text }}>{s.userName}</Text>
                            <Text className="text-[9px] font-bold text-slate-400 mt-1">Sejak {timeStr} • Modal Awal: Rp {s.startingCash?.toLocaleString('id-ID')}</Text>
                          </View>
                          <View className="px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                            <Text className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Aktif</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            ) : (
              <FlatList
                data={closedShifts}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const systemRequired = (item.startingCash || 0) + (item.systemCalculatedCash || 0);
                  const actual = item.actualCash || 0;
                  const diff = item.difference ?? (actual - systemRequired);
                  const note = item.notes || item.note || '';

                  const startD = item.startTime?.toDate ? item.startTime.toDate() : (item.startTime ? new Date(item.startTime) : null);
                  const endD = item.endTime?.toDate ? item.endTime.toDate() : (item.endTime ? new Date(item.endTime) : null);

                  const dateStr = startD ? startD.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                  const timeRangeStr = (startD ? startD.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-') + ' → ' + (endD ? endD.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');

                  return (
                    <View className="p-4 rounded-2xl border mb-3 flex flex-col gap-3.5" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 pr-2">
                          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{dateStr}</Text>
                          <Text className="text-xs font-black" style={{ color: colors.text }}>Sesi Kasir: <Text style={{ color: colors.accent }}>{item.userName}</Text></Text>
                          <Text className="text-[9px] font-bold text-slate-400 mt-1">{timeRangeStr}</Text>
                        </View>
                        <View className={`px-2 py-0.5 rounded border ${
                          diff === 0 ? 'bg-emerald-500/10 border-emerald-500/20' :
                          diff > 0 ? 'bg-blue-500/10 border-blue-500/20' :
                          'bg-rose-500/10 border-rose-500/20'
                        }`}>
                          <Text className={`text-[8px] font-black uppercase ${
                            diff === 0 ? 'text-emerald-500' :
                            diff > 0 ? 'text-blue-500' :
                            'text-rose-500'
                          }`}>
                            {diff === 0 ? 'Sesuai' : diff > 0 ? 'Surplus' : 'Selisih'}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row gap-2.5">
                        <View className="flex-1 p-2.5 rounded-xl bg-black/10 border border-black/5">
                          <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Saldo Sistem</Text>
                          <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {systemRequired.toLocaleString('id-ID')}</Text>
                        </View>
                        <View className="flex-1 p-2.5 rounded-xl bg-black/10 border border-black/5">
                          <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Uang Fisik</Text>
                          <Text className="text-xs font-black text-emerald-400">Rp {actual.toLocaleString('id-ID')}</Text>
                        </View>
                      </View>

                      {diff !== 0 && (
                        <View className={`p-2.5 rounded-xl border flex-row items-center justify-between ${diff > 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
                          <Text className="text-[8px] font-black uppercase tracking-widest" style={{ color: diff > 0 ? '#10b981' : '#f43f5e' }}>{diff > 0 ? 'Kelebihan Uang' : 'Kekurangan Uang'}</Text>
                          <Text className="text-xs font-black" style={{ color: diff > 0 ? '#10b981' : '#f43f5e' }}>Rp {Math.abs(diff).toLocaleString('id-ID')}</Text>
                        </View>
                      )}

                      {note !== '' && (
                        <View className="p-2.5 bg-black/5 rounded-xl">
                          <Text className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Catatan:</Text>
                          <Text className="text-[10px] font-bold text-slate-400 italic">"{note}"</Text>
                        </View>
                      )}

                      {/* Delete action for Admin */}
                      {(role === 'admin' || role === 'superadmin' || role === 'super-admin') && (
                        <View className="flex-row justify-end pt-1">
                          <TouchableOpacity
                            onPress={() => handleDelete(item.id, 'shift')}
                            className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20"
                          >
                            <Trash2 size={12} color="#f43f5e" />
                            <Text className="text-[8px] font-black uppercase text-rose-500 tracking-wider">Hapus Sesi</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View className="items-center py-20 opacity-30">
                    <History color={colors.textMuted} size={48} />
                    <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada riwayat shift selesai</Text>
                  </View>
                }
              />
            )}

            {/* CLOSE SHIFT MODAL */}
            {isCloseShiftModalOpen && myActiveShift && (
              <Modal visible={isCloseShiftModalOpen} animationType="slide" transparent onRequestClose={() => setIsCloseShiftModalOpen(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                  <View className="flex-1 bg-black/70 justify-end items-center">
                    <View className="w-full rounded-t-[2.5rem] p-6 max-h-[90%]" style={{ backgroundColor: colors.surface }}>
                      
                      <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-3">
                          <View className="w-10 h-10 rounded-2xl bg-rose-500/10 items-center justify-center">
                            <Lock size={20} color="#f43f5e" />
                          </View>
                          <View>
                            <Text className="text-sm font-black" style={{ color: colors.text }}>Penutupan Sesi Kerja</Text>
                            <Text className="text-[10px] font-bold text-slate-400 mt-0.5">Lakukan Rekonsiliasi Kas Laci</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => setIsCloseShiftModalOpen(false)} className="p-2 bg-black/10 rounded-full">
                          <X size={16} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      <ScrollView className="space-y-5" showsVerticalScrollIndicator={false}>
                        <View className="p-4 bg-black/10 rounded-2xl border border-black/5 flex-row justify-between items-center">
                          <View>
                            <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Modal + Penjualan Tunai</Text>
                            <Text className="text-base font-black mt-1" style={{ color: colors.accent }}>
                              Rp {(myActiveShift.startingCash + activeShiftStats.cashSales).toLocaleString('id-ID')}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</Text>
                            <Text className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Berjalan</Text>
                          </View>
                        </View>

                        <View className="space-y-1.5">
                          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Total Uang Fisik Di Laci Kas (Rp)</Text>
                          <TextInput
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={actualCash}
                            onChangeText={setActualCash}
                            className="px-4 py-3.5 rounded-2xl border font-bold text-lg"
                            style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                          />
                          <Text className="text-[8px] text-slate-400 italic pl-1">*Hitung uang kertas & koin fisik secara teliti di laci.</Text>
                        </View>

                        <View className="space-y-1.5">
                          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Catatan Penutupan</Text>
                          <TextInput
                            placeholder="e.g. Setoran shift pagi aman..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={3}
                            value={closeNote}
                            onChangeText={setCloseNote}
                            className="px-4 py-3 rounded-2xl border font-bold text-xs h-20 text-start"
                            style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                          />
                        </View>

                        <View className="flex-row gap-3 pt-4">
                          <TouchableOpacity
                            onPress={() => setIsCloseShiftModalOpen(false)}
                            className="flex-1 py-4 bg-black/10 rounded-2xl items-center justify-center"
                          >
                            <Text className="text-xs font-black text-slate-400 uppercase tracking-widest">Batal</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleCloseShiftMobile}
                            disabled={isShiftProcessing}
                            className="flex-[2] py-4 bg-rose-500 rounded-2xl items-center justify-center flex-row gap-2"
                          >
                            {isShiftProcessing ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <>
                                <Lock size={14} color="#ffffff" />
                                <Text className="text-xs font-black text-white uppercase tracking-widest">TUTUP SHIFT</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </ScrollView>
                      
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </Modal>
            )}

            {/* RESET SHIFT MODAL */}
            {isResetShiftModalOpen && myActiveShift && (
              <Modal visible={isResetShiftModalOpen} animationType="fade" transparent onRequestClose={() => setIsResetShiftModalOpen(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                  <Pressable className="flex-1 bg-black/60 justify-center items-center p-6" onPress={() => setIsResetShiftModalOpen(false)}>
                    <Pressable className="w-full rounded-[2rem] p-6 space-y-5" style={{ backgroundColor: colors.surface }} onPress={() => {}}>
                      <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center gap-3">
                          <View className="w-10 h-10 rounded-2xl bg-rose-500/10 items-center justify-center">
                            <Trash2 size={20} color="#f43f5e" />
                          </View>
                          <View>
                            <Text className="text-sm font-black" style={{ color: colors.text }}>Reset Modal Awal</Text>
                            <Text className="text-[10px] font-bold text-slate-400 mt-0.5">Kosongkan saldo sesi aktif</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => setIsResetShiftModalOpen(false)} className="p-2 bg-black/10 rounded-full">
                          <X size={16} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      <View className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                        <Text className="text-[10px] font-bold text-rose-500 leading-relaxed">
                          Tindakan ini akan mengosongkan Modal Awal aktif menjadi Rp 0. Ketik "Kosongkan Saldo" di bawah untuk konfirmasi.
                        </Text>
                      </View>

                      <View className="space-y-1.5">
                        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Teks Verifikasi</Text>
                        <TextInput
                          placeholder="Kosongkan Saldo"
                          placeholderTextColor={colors.textMuted}
                          value={resetConfirmText}
                          onChangeText={setResetConfirmText}
                          className="px-4 py-3 rounded-xl border font-bold text-xs"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={handleResetStartingCashMobile}
                        disabled={isResettingShift || resetConfirmText !== 'Kosongkan Saldo'}
                        activeOpacity={0.8}
                        className="py-4 bg-rose-500 rounded-2xl items-center justify-center flex-row gap-2 disabled:opacity-50"
                      >
                        {isResettingShift ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Check size={14} color="#ffffff" />
                            <Text className="text-xs font-black text-white uppercase tracking-widest">KONFIRMASI KOSONGKAN SALDO</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </Pressable>
                  </Pressable>
                </KeyboardAvoidingView>
              </Modal>
            )}
          </View>
        );

      case 'staff':
        return (
          <FlatList
            data={staffs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View className="p-4 rounded-2xl border mb-3 flex-row justify-between items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }}>
                    <Text className="text-xs font-black uppercase" style={{ color: colors.accent }}>
                      {(item.name || item.email || 'US').substring(0, 2)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-black" style={{ color: colors.text }} numberOfLines={1}>{item.name || 'User Tanpa Nama'}</Text>
                    <Text className="text-[10px] font-bold text-slate-400 mt-0.5" numberOfLines={1}>{item.email}</Text>
                    <View className="flex-row items-center gap-2 mt-1.5">
                      <View 
                        className="px-2 py-0.5 rounded-md border" 
                        style={{ 
                          backgroundColor: item.role === 'admin' ? colors.accent + '15' : colors.bg,
                          borderColor: item.role === 'admin' ? colors.accent + '30' : colors.border
                        }}
                      >
                        <Text className="text-[8px] font-black uppercase tracking-widest" style={{ color: item.role === 'admin' ? colors.accent : colors.textMuted }}>
                          {item.role === 'admin' ? 'Admin' : 'Kasir'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity 
                    onPress={() => {
                      Vibration.vibrate(10);
                      openPermissionModal(item);
                    }}
                    className="p-2.5 rounded-xl"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }}
                  >
                    <UserCog size={14} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleDeleteStaff(item)}
                    className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20"
                    style={{ borderWidth: 1 }}
                  >
                    <Trash2 size={14} color="#f43f5e" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <UserCheck color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada data staff terdaftar</Text>
              </View>
            }
          />
        );

      case 'activity_log':
        return (
          <FlatList
            data={activities}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View className="p-4 rounded-2xl border mb-3" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs font-black" style={{ color: colors.accent }}>{item.user}</Text>
                  <Text className="text-[9px] font-bold text-slate-500">{item.time}</Text>
                </View>
                <Text className="text-xs font-bold mt-1.5" style={{ color: colors.text }}>{item.desc}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-20 opacity-30">
                <ClipboardList color={colors.textMuted} size={48} />
                <Text className="text-xs font-bold mt-4" style={{ color: colors.textMuted }}>Belum ada catatan aktivitas</Text>
              </View>
            }
          />
        );

      default:
        return (
          <View className="items-center py-20">
            <AlertTriangle color={colors.textMuted} size={48} />
            <Text className="text-sm font-bold mt-4" style={{ color: colors.textMuted }}>Modul Tidak Dikenali</Text>
          </View>
        );
    }
  };

  const showFloatingButton = [
    'estimasi', 'piutang', 'ekstra', 'diskon', 
    'pelanggan', 'staff', 'arus_kas', 'tutup_buku'
  ].includes(featureId);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text className="text-xs font-black uppercase tracking-widest mt-4" style={{ color: colors.textMuted }}>Menyinkronkan Cloud...</Text>
      </SafeAreaView>
    );
  }

  if (isSubscriptionExpired && featureId === 'staff' && role !== 'super-admin' && role !== 'superadmin') {
    return (
      <SafeAreaView className="flex-1 justify-center items-center px-6" style={{ backgroundColor: colors.bg }}>
        <View 
          className="w-20 h-20 rounded-3xl items-center justify-center mb-6 border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Lock color="#f43f5e" size={40} />
        </View>
        <Text className="text-lg font-black text-center uppercase tracking-wider mb-2" style={{ color: colors.text }}>Akses Terkunci</Text>
        <Text className="text-xs font-bold text-center leading-normal mb-8" style={{ color: colors.textMuted }}>
          Masa aktif langganan toko Anda telah berakhir. Silakan perpanjang untuk memulihkan akses manajemen staff & user.
        </Text>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate('Lainnya', { openSubscription: true });
          }}
          activeOpacity={0.8}
          className="w-full py-4 rounded-2xl items-center justify-center border"
          style={{ backgroundColor: colors.accent, borderColor: colors.accent }}
        >
          <Text className="text-xs font-black text-white uppercase tracking-widest">Perpanjang Sekarang</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-4 py-2"
        >
          <Text className="text-xs font-black uppercase tracking-wider" style={{ color: '#ef4444' }}>Kembali</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: colors.bg }}>
      
      {/* Search Header for list views */}
      {['estimasi', 'piutang', 'gudang', 'ekstra', 'diskon', 'pelanggan', 'staff', 'shift', 'arus_kas'].includes(featureId) && (
        <View className="px-6 py-4 border-b" style={{ borderColor: colors.border }}>
          <View 
            className="flex-row items-center px-4 py-3.5 rounded-2xl border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Search size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Cari data..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              className="flex-1 ml-3 font-bold text-xs"
              style={{ color: colors.text }}
            />
          </View>
        </View>
      )}

      {/* Main Content Layout */}
      <View className="flex-1 px-6 pt-4">
        {renderContent()}
      </View>

      {/* Floating Add Button for lists */}
      {showFloatingButton && (
        <TouchableOpacity
          onPress={() => openFormModal()}
          activeOpacity={0.8}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-2xl"
          style={{ backgroundColor: colors.accent, shadowColor: colors.accent }}
        >
          <Plus color="#ffffff" size={24} />
        </TouchableOpacity>
      )}

      {/* ADD NEW RECORD MODAL */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent onRequestClose={() => setIsAddModalVisible(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end items-center">
            <View className="w-full max-w-xl rounded-t-[40px] p-6 pb-10" style={{ backgroundColor: colors.surface }}>
              
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-6">
                <View>
                  <Text className="text-xl font-black" style={{ color: colors.text }}>
                    {editId ? 'Edit' : 'Tambah'} {title}
                  </Text>
                  <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>
                    {editId ? 'Sempurnakan rincian data di bawah ini' : 'Masukkan detail data di bawah ini'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setIsAddModalVisible(false)} 
                  className="w-10 h-10 rounded-full bg-black/10 items-center justify-center"
                >
                  <X color={colors.text} size={20} />
                </TouchableOpacity>
              </View>

              {/* Form Input Fields */}
              <ScrollView className="max-h-[450px] mb-6" showsVerticalScrollIndicator={false}>
                {renderFormFields()}
              </ScrollView>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.8}
                className="w-full py-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.accent }}
              >
                <Text className="font-black text-white text-xs uppercase tracking-wider">
                  {editId ? 'Perbarui Data' : 'Simpan Data'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Item Edit Modal */}
      <Modal visible={editingDebtItemIndex !== null} animationType="fade" transparent onRequestClose={() => setEditingDebtItemIndex(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 bg-black/60 items-center justify-center p-4">
            <View className="w-full max-w-xl rounded-3xl p-6" style={{ backgroundColor: colors.surface }}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-base font-black" style={{ color: colors.text }}>Edit Item & Catatan</Text>
                <TouchableOpacity onPress={() => setEditingDebtItemIndex(null)} className="w-8 h-8 rounded-full bg-black/10 items-center justify-center">
                  <X color={colors.text} size={16} />
                </TouchableOpacity>
              </View>

              <View className="space-y-4">
                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1">
                    <Text className="text-[10px] font-black uppercase mb-1.5" style={{ color: colors.textMuted }}>Kuantitas (Qty)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={editDebtItemData.qty}
                      onChangeText={(t) => setEditDebtItemData({...editDebtItemData, qty: t})}
                      className="px-4 py-3 rounded-2xl border font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  <View className="flex-[2]">
                    <Text className="text-[10px] font-black uppercase mb-1.5" style={{ color: colors.textMuted }}>Harga Satuan (Rp)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={editDebtItemData.price}
                      onChangeText={(t) => setEditDebtItemData({...editDebtItemData, price: t})}
                      className="px-4 py-3 rounded-2xl border font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                </View>

                <View className="mb-6">
                  <Text className="text-[10px] font-black uppercase mb-1.5" style={{ color: colors.textMuted }}>Catatan Item (Opsional)</Text>
                  <TextInput
                    value={editDebtItemData.note}
                    onChangeText={(t) => setEditDebtItemData({...editDebtItemData, note: t})}
                    placeholder="Contoh: Warna merah, tanpa gula"
                    placeholderTextColor={colors.textMuted}
                    className="px-4 py-3 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>

                <TouchableOpacity 
                  onPress={handleSaveDebtItem}
                  className="w-full py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Text className="text-xs font-black text-white uppercase tracking-widest">Simpan Perubahan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* STOCK OPNAME/ADJUSTMENT MODAL */}
      <Modal visible={isAdjustModalVisible} animationType="slide" transparent onRequestClose={() => setIsAdjustModalVisible(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end items-center">
            <View className="w-full max-w-xl rounded-t-[40px] p-6 pb-10" style={{ backgroundColor: colors.surface }}>
              {/* Header */}
              <View className="flex-row justify-between items-start mb-6">
                <View>
                  <Text className="text-xl font-black uppercase tracking-tighter" style={{ color: colors.text }}>
                    {mutationType === 'penyesuaian' ? 'Opname' : 'Mutasi'} Stok
                  </Text>
                  <Text className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: colors.textMuted }}>
                    {selectedProduct?.name}
                  </Text>
                </View>
                <TouchableOpacity 
                  disabled={isSavingStock}
                  onPress={() => {
                    setIsAdjustModalVisible(false);
                    setSelectedProduct(null);
                  }}
                  className="w-10 h-10 rounded-full bg-black/10 items-center justify-center"
                >
                  <X color={colors.text} size={20} />
                </TouchableOpacity>
              </View>

              {/* Form Body */}
              <ScrollView className="max-h-[400px] mb-6" showsVerticalScrollIndicator={false}>
                {/* Type Selection */}
                <View className="mb-4">
                  <Text className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>Jenis Mutasi</Text>
                  <View className="flex-row gap-2 bg-black/10 p-1 rounded-2xl border" style={{ borderColor: colors.border }}>
                    {(['masuk', 'keluar', 'penyesuaian'] as const).map(type => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setMutationType(type)}
                        className="flex-1 py-3 items-center justify-center rounded-xl"
                        style={{ backgroundColor: mutationType === type ? colors.accent : 'transparent' }}
                      >
                        <Text className="text-[10px] font-black uppercase" style={{ color: mutationType === type ? '#ffffff' : colors.text }}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Mutation Quantity */}
                <View className="mb-4">
                  <Text className="text-[10px] font-black uppercase tracking-widest mb-2 text-center" style={{ color: colors.textMuted }}>
                    {mutationType === 'penyesuaian' ? 'Ubah Menjadi Angka Pasti' : 'Total Unit'}
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={mutationQty}
                    onChangeText={setMutationQty}
                    className="w-full px-4 py-4 rounded-2xl border font-black text-2xl text-center tracking-tighter"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />

                  {mutationQty.trim() !== '' && (
                    <View className="p-3 rounded-xl mt-3 border text-center" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                      <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: colors.textMuted }}>
                        Estimasi Akhir:{' '}
                        <Text style={{ color: mutationType === 'masuk' ? '#10b981' : mutationType === 'keluar' ? '#f43f5e' : colors.accent }}>
                          {mutationType === 'masuk' ? (selectedProduct?.stock || 0) + (parseFloat(mutationQty) || 0) : 
                           mutationType === 'keluar' ? Math.max(0, (selectedProduct?.stock || 0) - (parseFloat(mutationQty) || 0)) : 
                           (parseFloat(mutationQty) || 0)}
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>

                {/* Mutation Note */}
                <View className="mb-4">
                  <Text className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: colors.textMuted }}>Catatan (Opsional)</Text>
                  <TextInput
                    placeholder="e.g. Barang datang dari supplier..."
                    placeholderTextColor={colors.textMuted}
                    value={mutationNote}
                    onChangeText={setMutationNote}
                    className="w-full p-4 rounded-2xl border font-bold text-xs"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                  />
                </View>
              </ScrollView>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleAdjustStock}
                disabled={isSavingStock || !mutationQty}
                activeOpacity={0.8}
                className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
                style={{ backgroundColor: colors.accent, opacity: (isSavingStock || !mutationQty) ? 0.6 : 1 }}
              >
                {isSavingStock ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <ArrowRightLeft size={16} color="#ffffff" />
                )}
                <Text className="font-black text-white text-xs uppercase tracking-widest">
                  {isSavingStock ? 'Menyimpan...' : 'Konfirmasi Mutasi'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PRODUCT & CATEGORY SELECTOR MODAL FOR DISCOUNTS */}
      <Modal visible={isSelectorModalVisible} animationType="slide" transparent onRequestClose={() => setIsSelectorModalVisible(false)}>
        <SafeAreaView className="flex-1 bg-black/80 justify-end items-center" edges={['top', 'bottom']}>
          <View className="w-full max-w-xl rounded-t-[40px] p-6 pb-8 flex-1" style={{ backgroundColor: colors.surface }}>
            {/* Header */}
            <View className="flex-row justify-between items-start mb-6">
              <View>
                <Text className="text-xl font-black" style={{ color: colors.text }}>Target Diskon</Text>
                <Text className="text-xs font-bold" style={{ color: colors.textMuted }}>Pilih Produk atau Kategori</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSelectorModalVisible(false)}
                className="w-10 h-10 rounded-full bg-black/10 items-center justify-center"
              >
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            {/* Tab Selector */}
            <View className="flex-row bg-black/10 p-1 rounded-2xl gap-1 mb-4">
              <TouchableOpacity
                onPress={() => setSelectorTab('product')}
                className="flex-1 py-3 rounded-xl items-center justify-center flex-row gap-2"
                style={{ backgroundColor: selectorTab === 'product' ? colors.accent : 'transparent' }}
              >
                <Package size={14} color={selectorTab === 'product' ? '#ffffff' : colors.textMuted} />
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: selectorTab === 'product' ? '#ffffff' : colors.text }}>
                  Barang
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectorTab('category')}
                className="flex-1 py-3 rounded-xl items-center justify-center flex-row gap-2"
                style={{ backgroundColor: selectorTab === 'category' ? colors.accent : 'transparent' }}
              >
                <ListFilter size={14} color={selectorTab === 'category' ? '#ffffff' : colors.textMuted} />
                <Text className="text-[10px] font-black uppercase tracking-widest" style={{ color: selectorTab === 'category' ? '#ffffff' : colors.text }}>
                  Kategori
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input for Products */}
            {selectorTab === 'product' && (
              <View className="relative mb-4">
                <View className="flex-row items-center px-4 py-3 rounded-2xl border" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                  <Search size={16} color={colors.textMuted} />
                  <TextInput
                    placeholder="Cari barang..."
                    placeholderTextColor={colors.textMuted}
                    value={selectorSearch}
                    onChangeText={setSelectorSearch}
                    className="flex-1 ml-3 font-bold text-xs"
                    style={{ color: colors.text }}
                  />
                </View>
              </View>
            )}

            {/* Selector List */}
            <FlatList
              data={
                selectorTab === 'product'
                  ? allProducts.filter(p => !selectorSearch || p.name.toLowerCase().includes(selectorSearch.toLowerCase()))
                  : allCategories
              }
              keyExtractor={(item, index) => (selectorTab === 'product' ? item.id : String(index))}
              renderItem={({ item }) => {
                if (selectorTab === 'product') {
                  const isSelected = tempSelectedProductIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        Vibration.vibrate(10);
                        if (isSelected) {
                          setTempSelectedProductIds(prev => prev.filter(id => id !== item.id));
                        } else {
                          setTempSelectedProductIds(prev => [...prev, item.id]);
                        }
                      }}
                      activeOpacity={0.8}
                      className="flex-row items-center justify-between p-4 rounded-2xl border mb-2"
                      style={{
                        backgroundColor: isSelected ? colors.accent + '0d' : colors.bg,
                        borderColor: isSelected ? colors.accent : colors.border
                      }}
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="p-1 rounded-md" style={{ backgroundColor: isSelected ? colors.accent : 'transparent' }}>
                          <CheckCircle size={16} color={isSelected ? '#ffffff' : colors.textMuted} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-black" style={{ color: colors.text }} numberOfLines={1}>{item.name}</Text>
                          <Text className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">
                            {item.category || 'Umum'} • Rp {item.price?.toLocaleString('id-ID')}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                } else {
                  // Category selection
                  // All product IDs in this category
                  const categoryName = item;
                  const prodsInCat = allProducts.filter(p => p.category === categoryName).map(p => p.id);
                  const allSelected = prodsInCat.every(id => tempSelectedProductIds.includes(id));
                  const someSelected = prodsInCat.some(id => tempSelectedProductIds.includes(id));

                  return (
                    <TouchableOpacity
                      onPress={() => {
                        Vibration.vibrate(10);
                        if (allSelected) {
                          // deselect all in this category
                          setTempSelectedProductIds(prev => prev.filter(id => !prodsInCat.includes(id)));
                        } else {
                          // select all in this category
                          setTempSelectedProductIds(prev => {
                            const set = new Set([...prev, ...prodsInCat]);
                            return Array.from(set);
                          });
                        }
                      }}
                      activeOpacity={0.8}
                      className="flex-row items-center justify-between p-4 rounded-2xl border mb-2"
                      style={{
                        backgroundColor: allSelected ? colors.accent + '0d' : colors.bg,
                        borderColor: allSelected ? colors.accent : colors.border
                      }}
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="p-1 rounded-md" style={{ backgroundColor: allSelected ? colors.accent : 'transparent' }}>
                          <CheckCircle size={16} color={allSelected ? '#ffffff' : (someSelected ? colors.accent : colors.textMuted)} />
                        </View>
                        <View>
                          <Text className="text-sm font-black uppercase tracking-tight" style={{ color: colors.text }}>{categoryName || 'Tanpa Kategori'}</Text>
                          <Text className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">{prodsInCat.length} Produk</Text>
                        </View>
                      </View>
                      <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: colors.surface }}>
                        <Text className="text-[8px] font-black uppercase tracking-wider" style={{ color: allSelected ? colors.accent : colors.text }}>
                          {allSelected ? 'Terpilih' : 'Pilih Semua'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
              }}
            />

            {/* Footer Actions */}
            <View className="flex-row items-center justify-between pt-4 border-t gap-4 mt-auto" style={{ borderColor: colors.border + '15' }}>
              <View className="hidden md:block">
                <Text className="text-xs font-black uppercase tracking-wider" style={{ color: colors.text }}>{tempSelectedProductIds.length} Barang</Text>
                <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Diterapkan</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSelectorModalVisible(false)}
                activeOpacity={0.8}
                className="flex-1 py-4 rounded-2xl items-center justify-center"
                style={{ backgroundColor: colors.accent }}
              >
                <Text className="font-black text-white text-xs uppercase tracking-widest">Konfirmasi Pilihan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* DEBT DETAIL & INSTALLMENT MODAL */}
      <Modal visible={!!selectedDebt} animationType="slide" transparent onRequestClose={() => setSelectedDebt(null)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end items-center">
            <View className="w-full max-w-xl rounded-t-[40px] p-6 pb-10 flex-col max-h-[90%]" style={{ backgroundColor: colors.surface }}>
              
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-5">
                <View>
                  <Text className="text-xl font-black" style={{ color: colors.text }}>
                    Rincian Piutang
                  </Text>
                  <Text className="text-xs font-bold text-slate-400">
                    Pelanggan: {selectedDebt?.customerName || 'Anonim'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedDebt(null)} 
                  className="w-10 h-10 rounded-full bg-black/10 items-center justify-center"
                >
                  <X color={colors.text} size={20} />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-[450px] mb-6" showsVerticalScrollIndicator={false}>
                {selectedDebt && (
                  <View className="flex gap-5">
                    {/* Top Summary Balance Cards */}
                    <View className="flex-row gap-2.5">
                      <View className="flex-1 bg-black/10 border border-black/5 p-4 rounded-2xl text-center">
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Belanja</Text>
                        <Text className="text-xs font-black" style={{ color: colors.text }}>Rp {selectedDebt.total?.toLocaleString('id-ID')}</Text>
                      </View>
                      <View className="flex-1 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center">
                        <Text className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Sisa Hutang</Text>
                        <Text className="text-xs font-black text-rose-500">
                          Rp {(selectedDebt.total - (selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0)).toLocaleString('id-ID')}
                        </Text>
                      </View>
                    </View>

                    {/* Bought Items list */}
                    <View>
                      <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-black/5 pb-1">Item Terbeli</Text>
                      <View className="flex gap-1.5">
                        {selectedDebt.items?.map((item: any, idx: number) => (
                          <View key={idx} className="p-3 rounded-xl border border-black/5 mb-1.5" style={{ backgroundColor: colors.surface, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 2 }}>
                            <View className="flex-row justify-between items-start">
                              <View className="flex-1 pr-2">
                                <Text className="text-xs font-bold" style={{ color: colors.text }}>{item.qty}x {item.productName}</Text>
                                {item.note && <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{item.note}</Text>}
                              </View>
                              <View className="items-end">
                                <Text className="text-[11px] font-black text-emerald-500">Rp {item.subtotal?.toLocaleString('id-ID')}</Text>
                              </View>
                            </View>
                            <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t border-black/5">
                              <TouchableOpacity 
                                onPress={() => {
                                  setEditDebtItemData({
                                    qty: item.qty?.toString() || '1',
                                    price: item.price?.toString() || '0',
                                    note: item.note || ''
                                  });
                                  setEditingDebtItemIndex(idx);
                                  Vibration.vibrate(10);
                                }} 
                                className="px-3 py-1.5 bg-amber-500/10 rounded-lg flex-row items-center gap-1.5 border border-amber-500/20"
                              >
                                <Edit2 size={12} color="#d97706" />
                                <Text className="text-[9px] font-black uppercase text-amber-600">Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                onPress={() => handleDeleteDebtItem(idx)} 
                                className="px-3 py-1.5 bg-rose-500/10 rounded-lg flex-row items-center gap-1.5 border border-rose-500/20"
                              >
                                <Trash2 size={12} color="#f43f5e" />
                                <Text className="text-[9px] font-black uppercase text-rose-500">Hapus</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Payment History Log */}
                    {selectedDebt.paymentHistory && selectedDebt.paymentHistory.length > 0 && (
                      <View>
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-black/5 pb-1">Riwayat Cicilan</Text>
                        <View className="flex gap-1.5">
                          {selectedDebt.paymentHistory.map((hist: any, i: number) => {
                            const histDate = hist.date ? new Date(hist.date).toLocaleDateString('id-ID') : '-';
                            const currentHistId = hist.id || i.toString();
                            return (
                              <View key={currentHistId} className="bg-black/5 border border-black/5 p-3 rounded-xl mb-1.5">
                                <View className="flex-row justify-between items-center mb-2">
                                  <Text className="text-[10px] font-black" style={{ color: colors.text }}>{histDate}</Text>
                                  <Text className="text-xs font-black text-emerald-500">
                                    +Rp {hist.amount?.toLocaleString('id-ID')}
                                  </Text>
                                </View>
                                {editingDebtNoteId === currentHistId ? (
                                  <View className="flex-row items-center gap-1 mt-1 mb-1 bg-white/10 rounded-lg pr-1">
                                    <TextInput
                                      value={editDebtNoteValue}
                                      onChangeText={setEditDebtNoteValue}
                                      placeholder="Catatan..."
                                      placeholderTextColor={colors.textMuted}
                                      className="flex-1 px-3 py-1.5 text-xs font-bold"
                                      style={{ color: colors.text, backgroundColor: colors.bg, borderRadius: 8 }}
                                    />
                                    <TouchableOpacity onPress={() => handleUpdateHistoryNote(currentHistId)} className="p-2 bg-emerald-500/10 rounded-lg ml-1">
                                      <CheckCircle size={14} color="#10b981" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setEditingDebtNoteId(null)} className="p-2 bg-rose-500/10 rounded-lg ml-1">
                                      <X size={14} color="#f43f5e" />
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <View className="flex-row items-center justify-between mt-0.5">
                                    <View className="flex-row items-center gap-2">
                                      <Text className="text-[10px] font-bold" style={{ color: colors.text }}>{hist.note || 'Pembayaran cicilan mobile'}</Text>
                                      <TouchableOpacity onPress={() => { setEditingDebtNoteId(currentHistId); setEditDebtNoteValue(hist.note || 'Pembayaran cicilan mobile'); }}>
                                        <Edit2 size={10} color={colors.accent} />
                                      </TouchableOpacity>
                                    </View>
                                    <Text className="text-[8px] text-slate-400 font-bold uppercase">Oleh: {hist.cashierName}</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Print buttons / share signature buttons */}
                    <View className="flex-row gap-2 border-t pt-4" style={{ borderColor: colors.border + '15' }}>
                      <TouchableOpacity
                        onPress={() => {
                          Vibration.vibrate(10);
                          handlePrintA4(selectedDebt);
                        }}
                        className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl flex items-center justify-center gap-1"
                      >
                        <Text className="text-[9px] font-black uppercase tracking-widest text-emerald-500 text-center">Cetak A4</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          Vibration.vibrate(10);
                          handlePrintThermal(selectedDebt);
                        }}
                        className="flex-1 py-3 bg-slate-500/10 border border-slate-500/20 text-slate-600 rounded-xl flex items-center justify-center gap-1"
                      >
                        <Text className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">Struk Thermal</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Form Input payment cicilan */}
                    {selectedDebt.paymentStatus !== 'paid' && (
                      <View className="border-t pt-4" style={{ borderColor: colors.border + '15' }}>
                        <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">Masukkan Nominal Pembayaran</Text>
                        <TextInput
                          keyboardType="numeric"
                          value={debtPaymentAmount}
                          onChangeText={setDebtPaymentAmount}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          className="w-full px-4 py-3 rounded-2xl border font-black text-lg text-center mb-2"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        />
                        <TextInput
                          value={debtPaymentNote}
                          onChangeText={setDebtPaymentNote}
                          placeholder="Catatan pembayaran (opsional)"
                          placeholderTextColor={colors.textMuted}
                          className="w-full px-4 py-3 rounded-2xl border font-bold text-xs"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                        />

                        {/* Helper shortcuts */}
                        <View className="flex-row gap-2.5 mt-2.5">
                          <TouchableOpacity
                            onPress={() => {
                              Vibration.vibrate(10);
                              const remaining = selectedDebt.total - (selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0);
                              setDebtPaymentAmount(remaining.toString());
                            }}
                            className="bg-accent/10 px-3 py-1.5 rounded-lg"
                          >
                            <Text className="text-[9px] font-black text-accent uppercase">Bayar Lunas</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Vibration.vibrate(10);
                              setDebtPaymentAmount('50000');
                            }}
                            className="bg-black/10 px-3 py-1.5 rounded-lg"
                          >
                            <Text className="text-[9px] font-black text-slate-400 uppercase">+50Rb</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Vibration.vibrate(10);
                              setDebtPaymentAmount('100000');
                            }}
                            className="bg-black/10 px-3 py-1.5 rounded-lg"
                          >
                            <Text className="text-[9px] font-black text-slate-400 uppercase">+100Rb</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                  </View>
                )}
              </ScrollView>

              {/* Installment save button */}
              {selectedDebt && selectedDebt.paymentStatus !== 'paid' && (
                <TouchableOpacity
                  onPress={handlePayInstallment}
                  disabled={isSubmittingDebtPayment || !debtPaymentAmount || parseFloat(debtPaymentAmount) <= 0}
                  activeOpacity={0.8}
                  className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
                  style={{ backgroundColor: colors.accent, opacity: (isSubmittingDebtPayment || !debtPaymentAmount) ? 0.6 : 1 }}
                >
                  {isSubmittingDebtPayment && <ActivityIndicator size="small" color="#ffffff" />}
                  <Text className="font-black text-white text-xs uppercase tracking-widest">
                    {isSubmittingDebtPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}
                  </Text>
                </TouchableOpacity>
              )}

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. MODAL EDIT IZIN AKSES */}
      <Modal visible={isPermModalOpen} animationType="slide" transparent onRequestClose={() => setIsPermModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end items-center">
          <View className="w-full max-w-xl rounded-t-[40px] p-6 pb-10 flex-col max-h-[85%]" style={{ backgroundColor: colors.surface }}>
            
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5 border-b pb-3" style={{ borderColor: colors.border + '15' }}>
              <View className="flex-1 pr-2">
                <Text className="text-sm font-black uppercase tracking-tight" style={{ color: colors.text }} numberOfLines={1}>
                  Izin Akses: <Text style={{ color: colors.accent }}>{selectedStaff?.name || selectedStaff?.email}</Text>
                </Text>
                <Text className="text-[10px] font-bold text-slate-400">
                  Setel izin akses operator sistem POS
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsPermModalOpen(false)} 
                className="w-10 h-10 rounded-full bg-black/10 items-center justify-center"
              >
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[450px] mb-6" showsVerticalScrollIndicator={false}>
              <View className="flex gap-3">
                {[
                  { key: 'canAccessPOS', label: 'Buka Menu Kasir (POS)', desc: 'Boleh melakukan transaksi penjualan' },
                  { key: 'canManageProducts', label: 'Manajemen Produk', desc: 'Akses ke daftar/stok barang' },
                  { key: 'canViewReports', label: 'Buka Menu Laporan', desc: 'Boleh melihat omzet & riwayat' },
                  { key: 'canManageEstimations', label: 'Estimasi Biaya', desc: 'Akses menu pembuatan penawaran harga' },
                  { key: 'canManageDebts', label: 'Hutang Piutang', desc: 'Manajemen piutang pelanggan' },
                  { key: 'canManageOrders', label: 'Daftar Pesanan', desc: 'Lihat & proses pesanan online/delivery' },
                  { key: 'canManageUsers', label: 'Kelola Staf / User', desc: 'Boleh tambah/edit data kasir lain' },
                  { key: 'canViewLogs', label: 'Log Aktivitas', desc: 'Lihat riwayat aktifitas sistem' },
                  { key: 'canEditSettings', label: 'Pengaturan Toko', desc: 'Boleh ubah profil & branding toko' },
                ].map(perm => (
                  <View key={perm.key} className="flex gap-2">
                    <View className="p-4 rounded-2xl border flex-row items-center justify-between" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-black" style={{ color: colors.text }}>{perm.label}</Text>
                        <Text className="text-[9px] font-bold text-slate-400 italic mt-0.5">{perm.desc}</Text>
                      </View>
                      <Switch
                        value={(editPermissions as any)[perm.key]}
                        onValueChange={(val) => {
                          const newPerms = { ...editPermissions, [perm.key]: val };
                          if (perm.key === 'canManageProducts') {
                            newPerms.canCreateProducts = val;
                            newPerms.canEditProducts = val;
                            newPerms.canDeleteProducts = val;
                          }
                          setEditPermissions(newPerms);
                        }}
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#ffffff"
                      />
                    </View>

                    {/* Sub-permissions under Product Management */}
                    {perm.key === 'canManageProducts' && editPermissions.canManageProducts && (
                      <View className="ml-6 pl-3 border-l-2 space-y-2 pb-1" style={{ borderColor: colors.accent + '30' }}>
                        {[
                          { key: 'canCreateProducts', label: 'Tambah Barang' },
                          { key: 'canEditProducts', label: 'Edit / Update Barang' },
                          { key: 'canDeleteProducts', label: 'Hapus Barang' },
                        ].map(sub => (
                          <View key={sub.key} className="p-3 rounded-xl border flex-row items-center justify-between" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                            <Text className="text-[10px] font-black" style={{ color: colors.text }}>{sub.label}</Text>
                            <Switch
                              value={(editPermissions as any)[sub.key]}
                              onValueChange={(val) => setEditPermissions(prev => ({ ...prev, [sub.key]: val }))}
                              trackColor={{ false: colors.border, true: colors.accent }}
                              thumbColor="#ffffff"
                              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleUpdatePermissions}
              disabled={isSavingPerms}
              activeOpacity={0.8}
              className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
              style={{ backgroundColor: colors.accent, opacity: isSavingPerms ? 0.6 : 1 }}
            >
              {isSavingPerms && <ActivityIndicator size="small" color="#ffffff" />}
              <Text className="font-black text-white text-xs uppercase tracking-widest">
                {isSavingPerms ? 'Menyimpan...' : 'Simpan Izin'}
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
