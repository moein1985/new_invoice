'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Plus, Trash2, Mic, Square, Play, Pause } from 'lucide-react';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';
import { useRef } from 'react';

type PurchaseItemForm = {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedPrice: number | null;
};

const UNITS = ['عدد', 'متر', 'کیلوگرم', 'لیتر', 'بسته', 'شاخه', 'رول', 'کارتن', 'مترمربع', 'مترمکعب', 'تن', 'دستگاه', 'جفت', 'حلقه'];

export default function NewPurchasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [projectId, setProjectId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [items, setItems] = useState<PurchaseItemForm[]>([
    { id: Math.random().toString(36).substring(2), productName: '', description: '', quantity: 1, unit: 'عدد', estimatedPrice: null },
  ]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: projects } = trpc.project.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!session }
  );

  const { data: users } = trpc.purchase.getUsers.useQuery(undefined, {
    enabled: !!session && (session.user.role === 'ADMIN' || session.user.role === 'MANAGER'),
  });

  const createMutation = trpc.purchase.create.useMutation({
    onSuccess: (data) => {
      toast.success('درخواست خرید با موفقیت ایجاد شد');
      router.push(`/purchases/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'خطا در ایجاد درخواست خرید');
    },
  });

  const addItem = () => {
    setItems([...items, {
      id: Math.random().toString(36).substring(2),
      productName: '',
      description: '',
      quantity: 1,
      unit: 'عدد',
      estimatedPrice: null,
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map((i) => i.id === id ? { ...i, [field]: value } : i));
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('ضبط صوت در محیط HTTP پشتیبانی نمی‌شود. به HTTPS یا localhost متصل شوید');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error('دسترسی به میکروفون امکان‌پذیر نیست. برای ضبط صدا اتصال HTTPS لازم است');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !voiceUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const deleteVoice = () => {
    setVoiceBlob(null);
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceUrl(null);
    setIsPlaying(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('عنوان درخواست الزامی است');
      return;
    }

    const validItems = items.filter((i) => i.productName.trim());
    if (validItems.length === 0) {
      toast.error('حداقل یک قلم با نام محصول الزامی است');
      return;
    }

    // Upload voice if exists
    let voiceNotePath: string | undefined;
    if (voiceBlob) {
      setVoiceUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', voiceBlob, 'voice.webm');
        formData.append('type', 'voice');
        const res = await fetch('/api/upload/purchase', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        voiceNotePath = data.filePath;
      } catch {
        toast.error('خطا در آپلود پیام صوتی');
        setVoiceUploading(false);
        return;
      }
      setVoiceUploading(false);
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: priority as any,
      projectId: projectId || undefined,
      assignedToId: assignedToId || undefined,
      deadline: deadline || undefined,
      voiceNote: voiceNotePath || undefined,
      items: validItems.map((i) => ({
        productName: i.productName,
        description: i.description || undefined,
        quantity: i.quantity,
        unit: i.unit,
        estimatedPrice: i.estimatedPrice || undefined,
      })),
    });
  };

  if (status === 'loading') return <PageSkeleton />;
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
    router.push('/purchases');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Breadcrumb items={[
        { label: 'سامانه خرید', href: '/purchases' },
        { label: 'درخواست جدید' },
      ]} />

      <h1 className="text-2xl font-bold text-gray-900">درخواست خرید جدید</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
        {/* Basic Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان درخواست *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="مثلا: خرید لوازم دفتری"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اولویت</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="LOW">کم</option>
              <option value="MEDIUM">متوسط</option>
              <option value="HIGH">زیاد</option>
              <option value="URGENT">فوری</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">پروژه / محل استفاده</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">انتخاب کنید</option>
              {projects?.data?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مسئول استعلام (کاربر)</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">انتخاب کنید</option>
              {users?.map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مهلت استعلام</label>
            <JalaliDatePicker
              value={deadline}
              onChange={setDeadline}
              placeholder="انتخاب تاریخ"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="توضیحات تکمیلی..."
          />
        </div>

        {/* Voice Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">پیام صوتی (اختیاری)</label>
          <div className="flex items-center gap-3">
            {!voiceBlob ? (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isRecording ? <Square size={16} /> : <Mic size={16} />}
                {isRecording ? 'توقف ضبط' : 'ضبط صدا'}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
                <button type="button" onClick={togglePlayback} className="text-blue-600 hover:text-blue-800">
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <audio
                  ref={audioRef}
                  src={voiceUrl || undefined}
                  onEnded={() => setIsPlaying(false)}
                />
                <span className="text-xs text-gray-500">پیام صوتی ضبط شد</span>
                <button type="button" onClick={deleteVoice} className="text-red-500 hover:text-red-700 mr-2">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">اقلام درخواست *</label>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus size={16} />
              افزودن قلم
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">قلم {idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="نام محصول *"
                      value={item.productName}
                      onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="تعداد"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      min={0.01}
                      step="any"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="توضیحات قلم"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      placeholder="قیمت تخمینی (تومان)"
                      value={item.estimatedPrice || ''}
                      onChange={(e) => updateItem(item.id, 'estimatedPrice', e.target.value ? Number(e.target.value) : null)}
                      min={0}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              {/* Add item below */}
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const newId = Math.random().toString(36).substring(2);
                    setItems([
                      ...items.slice(0, idx + 1),
                      { id: newId, productName: '', description: '', quantity: 1, unit: 'عدد', estimatedPrice: null },
                      ...items.slice(idx + 1),
                    ]);
                  }}
                  className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                >
                  + افزودن قلم
                </button>
              </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => router.push('/purchases')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            انصراف
          </button>
          <LoadingButton
            onClick={handleSubmit}
            isLoading={createMutation.isPending || voiceUploading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ایجاد درخواست
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
