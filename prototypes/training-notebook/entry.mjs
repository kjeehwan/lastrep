const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const onboarding = document.body.dataset.study === 'onboarding';
const scenes = onboarding ? ['experience','availability','nickname','health'] : ['sign-in','sign-up','invalid','registered','offline','connecting','success'];
const titles = {'sign-in':'Welcome back.','sign-up':'Start your notebook.',experience:'Where are you starting?',availability:'Make room for training.',nickname:'What should we call you?',health:'Optional health sync',invalid:'Check your details',registered:'An existing account',offline:'Connection unavailable',connecting:'Connecting with Google',success:'Signed in'};
let scene = scenes[0], step = scene, values = {}, error = '', busy = false, showPassword = false;
const steps = ['experience','availability','nickname','health'];
const button = (label, action, primary = false, disabled = false) => `<button type="button" class="btn${primary?' primary':''}" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
const field = (label, key, type = 'text', hint = '') => `<label class="entry-field">${label}<input name="${key}" type="${type}" value="${escape(values[key] || '')}" autocomplete="off" ${key==='email'?'inputmode="email"':''} ${hint?`placeholder="${hint}"`:''}></label>`;
const choices = (key, labels) => `<div class="entry-options" role="radiogroup" aria-label="${key}">${labels.map(label=>`<button type="button" class="btn entry-choice" role="radio" aria-checked="${values[key]===label}" data-choice="${key}" data-value="${label}"><span>${label}</span><span aria-hidden="true">${values[key]===label?'●':'○'}</span></button>`).join('')}</div>`;
function authPage(){
  const signup = step === 'sign-up';
  if(scene==='success') return `<div class="entry-intro"><p class="entry-topline">Account ready</p><h1>Welcome back.</h1><p>Your notebook is ready.</p></div><p class="supporting" role="status">Sign-in simulated. No account was accessed.</p>${button('Review Home','home',true)}${button('Back to sign in','sign-in')}`;
  return `<div class="entry-brand">Lastrep</div><div class="entry-intro"><h1>${titles[step]}</h1><p class="supporting">${signup?'A place for your training, nutrition and recovery.':'Pick up where you left off.'}</p></div><form class="entry-form" novalidate>${field('Email','email','email','you@example.com')}<div class="entry-field"><label for="entry-password">Password</label><div class="entry-password"><input id="entry-password" name="password" type="${showPassword?'text':'password'}" value="${escape(values.password||'')}" autocomplete="off"><button type="button" data-action="password" aria-label="${showPassword?'Hide':'Show'} password">${showPassword?'Hide':'Show'}</button></div>${signup?'<small class="supporting">At least 6 characters.</small>':''}</div>${error?`<p class="entry-error" role="alert">${escape(error)}</p>`:''}<button class="btn primary" ${busy?'disabled':''}>${busy?'Connecting…':signup?'Sign up':'Sign in'}</button></form><div class="entry-divider">or</div>${button(busy?'Connecting…':'Continue with Google','google',false,busy)}<div class="entry-footer"><p class="supporting">${signup?'Already have an account?':"Don’t have an account?"}</p>${button(signup?'Sign in':'Sign up',signup?'sign-in':'sign-up')}</div>`;
}
function onboardPage(){
  const index = steps.indexOf(step);
  let content = '';
  if(step==='experience') content=choices('experience',['Beginner','Intermediate','Advanced']);
  if(step==='availability') content=`<p class="supporting">Choose a number of training days you can usually manage.</p><label class="entry-field" for="training-days">Training days per week</label><div class="entry-slider-value"><output for="training-days" aria-live="polite"><strong data-days-value>${values.days||4}</strong> days / week</output></div><input id="training-days" name="days" type="range" min="1" max="7" step="1" value="${values.days||4}" aria-valuetext="${values.days||4} days per week"><div class="entry-slider-ticks" aria-hidden="true">${[1,2,3,4,5,6,7].map(day=>`<span>${day}</span>`).join('')}</div><p class="supporting">You can change this later in Profile.</p>`;
  if(step==='nickname') content=field('Nickname (optional)','nickname','text','Your nickname')+'<p class="supporting">You can add or change your nickname later in Profile.</p>';
  if(step==='health') content=`<p>On supported Android devices, Lastrep can read sleep, weight, body-fat and lean-body-mass records that you permit.</p><div class="entry-note"><h3>Your choice, at any time.</h3><p>Imported summaries are stored in your Lastrep account for recovery, sleep and body-composition trends.</p><p>Relevant summaries may support AI-assisted recommendations. A separate disclosure appears before sending context to OpenAI.</p><p class="supporting">Nothing is connected during setup. You can connect later in Profile, disconnect there, or revoke access in your health service.</p></div>`;
  return `<div class="entry-progress" aria-label="Step ${index+1} of ${steps.length}">${steps.map((_,i)=>`<span class="${i<=index?'entry-complete':''}"></span>`).join('')}</div><div class="entry-intro"><p class="entry-topline">Getting started &middot; ${index+1} / ${steps.length}</p><h1>${titles[step]}</h1></div>${content}<div class="entry-actions">${button(step==='health'?'Go to Home':'Continue','next',true)}</div>`;
}
function onboardingHeader(){
  // Same production wordmark used by the approved Home study.
  const logo='<svg class="entry-logo" viewBox="0 0 132 41" role="img" aria-label="Lastrep"><defs><linearGradient id="entry-brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a90e2"/><stop offset="1" stop-color="#7b61ff"/></linearGradient></defs><text x="0" y="31" font-family="sans-serif" font-size="36" font-weight="bold" fill="url(#entry-brand)">lastrep</text></svg>';
  return `<header class="entry-onboarding-header">${logo}<nav class="entry-nav" aria-label="Onboarding">${button('&larr; Back','back')}${button('Skip','skip')}</nav></header>`;
}
function render(){
  const [width,height]=$('#viewport').value.split(',');
  $('#state-title').textContent=titles[scene];
  $('#stage').innerHTML=`<div><div class="device entry-device ${$('#dark').checked?'dark':''} ${$('#large').checked?'large-text':''}" style="--width:${width}px;--height:${height}px"><div class="system-bar" aria-hidden="true"><span>9:41</span><span>LTE &nbsp; 92%</span></div><div class="viewport">${onboarding?onboardingHeader():''}<div class="entry-content">${onboarding?onboardPage():authPage()}</div></div></div><p class="frame-caption">Proposed design &middot; synthetic interactions only</p></div>`;
}
function select(next){scene=next; step=steps.includes(next)?next:next==='sign-up'||next==='registered'?'sign-up':'sign-in'; error=next==='invalid'?'Email or password is incorrect.':next==='registered'?'This email is already registered. Try signing in instead.':next==='offline'?'You are offline. Reconnect and try again.':''; busy=next==='connecting';$('#example').value=next;render();}
$('#example').innerHTML=scenes.map(id=>`<option value="${id}">${titles[id]}</option>`).join('');
$('#example').onchange=event=>select(event.target.value);
for(const id of ['viewport','dark','large']) $('#'+id).onchange=render;
$('#reset').onclick=()=>{values={};showPassword=false;select(scenes[0]);};
function updateDays(value){
  values.days=String(Math.max(1,Math.min(7,Number(value))));
  $('[data-days-value]').textContent=values.days;
  const slider=$('#training-days');slider.value=values.days;slider.setAttribute('aria-valuetext',`${values.days} days per week`);
}
$('#stage').addEventListener('input',event=>{if(event.target.name){values[event.target.name]=event.target.value;if(event.target.name==='days')updateDays(event.target.value);}});
$('#stage').addEventListener('submit',event=>{event.preventDefault();if(busy)return;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email||'')){error='Please enter a valid email address.';render();return;}if((values.password||'').length<6){error=step==='sign-up'?'Use a password with at least 6 characters.':'Email or password is incorrect.';render();return;}if(step==='sign-up')location.href='./onboarding.html';else select('success');});
$('#stage').addEventListener('click',event=>{const target=event.target.closest('button');if(!target||target.disabled)return;if(target.dataset.choice){values[target.dataset.choice]=target.dataset.value;render();return;}const action=target.dataset.action;if(action==='password'){showPassword=!showPassword;render();}else if(action==='google'){error='Google account selection is simulated in this study. Choose a review state to inspect connecting or errors.';render();}else if(action==='home')location.href='./home.html';else if(action==='next'||action==='skip'){const i=steps.indexOf(step);if(i===steps.length-1)location.href='./home.html';else select(steps[i+1]);}else if(action==='back'){const i=steps.indexOf(step);if(i>0)select(steps[i-1]);else location.href='./auth.html';}else if(scenes.includes(action)||steps.includes(action))select(action);});
select(scene);
