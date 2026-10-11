import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Crown, Trophy, MousePointer2, LogOut, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key && !url.includes('YOUR_PROJECT') ? createClient(url, key) : null;
const fmt = n => new Intl.NumberFormat('ar-DZ').format(n || 0);

function App() {
  const [name, setName] = useState(localStorage.getItem('edt_name') || '');
  const [draft, setDraft] = useState('');
  const [player, setPlayer] = useState(null);
  const [board, setBoard] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [demoScore, setDemoScore] = useState(0);
  const [clicks, setClicks] = useState(0);
  const demo = !supabase;

  async function loadBoard() {
    if (!supabase) return;
    const { data, error } = await supabase.from('leaderboard').select('id, display_name, score, rank').order('rank').limit(10);
    if (!error && data) setBoard(data);
  }
  async function ensureSession() {
    if (!supabase) return true;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) { setNotice('تعذّر إنشاء جلسة لاعب. تأكد من تفعيل الدخول المجهول في Supabase.'); return false; }
    return true;
  }
  async function signIn(e) {
    e.preventDefault();
    const clean = draft.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 24) { setNotice('اكتب اسمًا من حرفين إلى 24 حرفًا.'); return; }
    if (demo) {
      setName(clean); localStorage.setItem('edt_name', clean);
      setPlayer({ id: 'demo', display_name: clean, score: Number(localStorage.getItem('edt_score_' + clean) || 0) });
      setNotice('أنت الآن في النسخة التجريبية؛ فعّل قاعدة البيانات لنشر نقاطك للجميع.');
      return;
    }
    setBusy(true); setNotice('');
    const ready = await ensureSession();
    if (!ready) { setBusy(false); return; }
    const { data, error } = await supabase.rpc('join_game', { p_name: clean });
    setBusy(false);
    if (error) { setNotice(error.message.includes('duplicate') ? 'هذا الاسم مستخدم، اختر اسمًا آخر.' : 'تعذّر تسجيل الدخول. تأكد من إعداد قاعدة البيانات.'); return; }
    setName(data.display_name); localStorage.setItem('edt_name', data.display_name); setPlayer(data);
    await loadBoard();
  }
  async function tap() {
    if (!player || busy) return;
    if (demo) {
      const next = demoScore + 1; setDemoScore(next); setClicks(c => c + 1);
      localStorage.setItem('edt_score_' + name, String(next));
      setPlayer(p => ({ ...p, score: next }));
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('add_click');
    setBusy(false);
    if (error) { setNotice('لم تُحفظ النقطة. حاول مجددًا.'); return; }
    setPlayer(p => ({ ...p, score: data }));
    setClicks(c => c + 1);
    if (clicks % 5 === 0) loadBoard();
  }
  function signOut() { setPlayer(null); setDraft(''); setNotice(''); }
  useEffect(() => {
    if (demo) {
      if (name) { const score = Number(localStorage.getItem('edt_score_' + name) || 0); setDemoScore(score); setPlayer({ id:'demo', display_name:name, score }); }
      return;
    }
    supabase.auth.getSession().then(async ({data}) => {
      if (data.session) {
        const {data: p} = await supabase.from('players').select('id,display_name,score').eq('id', data.session.user.id).maybeSingle();
        if (p) { setName(p.display_name); localStorage.setItem('edt_name', p.display_name); setPlayer(p); }
      }
    });
    loadBoard();
    const channel = supabase.channel('leaderboard-live').on('postgres_changes', {event:'*', schema:'public', table:'players'}, loadBoard).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  useEffect(() => { if (player && !demo) loadBoard(); }, [player?.id]);
  const podium = board.slice(0,3);
  return <main className="shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><Zap size={22}/></span><span>اضغط <b>تيسمسيلت</b><small>TISSEMSILT CLICK CHALLENGE</small></span></a>
      <span className="live"><i/> تحدّي الضغط</span>
    </header>
    <section className="hero">
      <div className="eyebrow"><span/> التحدي يبدأ من هنا</div>
      <h1>هل تستطيع أن تصبح<br/><em>ملك الضغط؟</em></h1>
      <p className="intro">كل ضغطة تقرّبك من القمة. نافس لاعبي تيسمسيلت واصنع مكانك بين الأوائل.</p>
      {!player ? <form className="login panel" onSubmit={signIn}>
        <label htmlFor="player-name">اختر اسم اللاعب</label>
        <div className="input-row"><input id="player-name" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={24} placeholder="اكتب اسمك هنا..." autoComplete="nickname"/><button disabled={busy} type="submit">{busy?'جارٍ الدخول...':'ابدأ اللعب'} <MousePointer2 size={17}/></button></div>
        <small className="hint"><ShieldCheck size={14}/> {demo?'نسخة معاينة: النقاط محفوظة على هذا الجهاز فقط.':'اسم فريد لكل لاعب، وسكور محفوظ في قاعدة البيانات.'}</small>
      </form> : <section className="game panel">
        <div className="player-line"><div className="avatar">{name.slice(0,1)}</div><div><small>مرحبًا بك</small><strong>{name}</strong></div><button className="icon-btn" onClick={signOut} title="تسجيل الخروج"><LogOut size={17}/></button></div>
        <div className="score-label">نقاطك الحالية</div><div className="score">{fmt(player.score)}</div>
        <button className="tap-button" onClick={tap} disabled={busy} aria-label="اضغط لإضافة نقطة"><span className="tap-glow"/><MousePointer2 size={38}/><strong>اضغط الآن!</strong><small>+1 نقطة لكل ضغطة</small></button>
        <div className="game-foot"><span><Zap size={15}/> {fmt(clicks)} ضغطة في هذه الجلسة</span><span className="gold-text">استمر نحو القمة</span></div>
      </section>}
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="stats"><div><strong>{demo?'—':fmt(board.length)}</strong><span>لاعبون في القائمة</span></div><div><strong>1</strong><span>نقطة لكل ضغطة</span></div><div><strong>24/7</strong><span>التحدي مستمر</span></div></div>
    </section>
    <section className="leaderboard panel">
      <div className="section-head"><div className="section-icon"><Trophy size={22}/></div><div><h2>قاعة المتصدرين</h2><p>أفضل اللاعبين في تيسمسيلت</p></div><button className="refresh" onClick={loadBoard} title="تحديث الترتيب"><RefreshCw size={17}/></button></div>
      {demo ? <div className="setup-note"><Trophy size={27}/><strong>المنافسة تنتظرك</strong><p>هذه معاينة للتصميم. اربط المشروع بقاعدة Supabase لتظهر نتائج جميع اللاعبين الحقيقية على الإنترنت.</p></div> : podium.length ? <div className="podium">{podium.map((p,i)=><div className={'podium-card place-'+(i+1)} key={p.id}><div className="medal">{i===0?<Crown/>:<Trophy/>}</div><span className="place">#{i+1}</span><strong className="podium-name">{p.display_name}</strong><b className="podium-score">{fmt(p.score)} <small>نقطة</small></b></div>)}</div> : <div className="empty">لا يوجد متصدرون بعد — كن أول من يلعب!</div>}
      {!demo && <div className="table">{board.map((p,i)=><div className="table-row" key={p.id}><span className={'rank rank-'+(i+1)}>{i+1}</span><span className="person">{p.display_name}</span><strong>{fmt(p.score)} <small>نقطة</small></strong></div>)}</div>}
      <div className="board-foot"><span><i/> {demo?'وضع المعاينة':'ترتيب اللاعبين'}</span><span>يتم الترتيب حسب النقاط</span></div>
    </section>
    <footer><div className="footer-brand"><Zap size={16}/> اضغط تيسمسيلت</div><p>صُنعت بروح المنافسة في تيسمسيلت 🇩🇿</p><small>العب بروح رياضية — كل ضغطة تصنع الفرق.</small></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);