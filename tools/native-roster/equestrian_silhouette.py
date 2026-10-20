"""Original equestrian silhouette sculpt on already fitted native surfaces.

A shared C2 field moves body, eyes, tack, original hair and added locks together.
The source rig and topology are inputs, never edited. All distances are metres.
"""
import numpy as np

VERSION=1
def profile(family,face,forehead,arch,rounding=.035,rear=.020,lift=.010,sweep=.028,cheek=.045):
    return {'family':family,'faceShortenM':face,'foreheadGain':forehead,'neckArchM':arch,
            'bodyRoundGain':rounding,'quarterExtraGain':rear,'quarterLiftM':lift,
            'neckSweepM':sweep,'cheekGain':cheek}

# Family-specific surface art: the same unchanged articulated foundation keeps
# each existing height/limb rig, while compactness and mass vary independently.
PROFILES={
 'percheron':profile('draft',.078,.16,.050,.045,.025,.016,.032,.055),
 'shire':profile('draft',.075,.14,.055,.045,.025,.016,.032,.055),
 'clyde':profile('draft',.072,.15,.052,.045,.025,.016,.032,.055),
 'vanner':profile('cob',.067,.15,.052,.045,.025,.016,.032,.055),
 'haflinger':profile('pony',.065,.15,.040,.045,.020,.012),
 'iceland':profile('pony',.067,.16,.035,.045,.020,.012),
 'welsh':profile('pony',.062,.14,.042,.040,.020,.012),
 'fjord':profile('pony',.060,.15,.035,.045,.020,.012),
 'bay':profile('stock',.054,.12,.040),
 'chestnut':profile('stock',.058,.13,.042),
 'palomino':profile('stock',.054,.12,.038),
 'pinto':profile('stock',.054,.12,.038),
 'appaloosa':profile('stock',.052,.11,.035),
 'sunset':profile('refined',.052,.11,.038),
 'stock':profile('stock',.055,.12,.035),
 'morgan':profile('stock',.060,.13,.045),
 'knab':profile('stock',.054,.12,.040),
 'grey':profile('baroque',.058,.13,.050,.040,.020,.012,.030),
 'black':profile('baroque',.058,.13,.050,.040,.020,.012,.030),
 'lipiz':profile('baroque',.058,.13,.050,.040,.020,.012,.030),
 'sport':profile('sport',.048,.10,.035,.030,.015,.009,.026,.035),
 'bay-sporthorse':profile('sport',.048,.10,.035,.030,.015,.009,.026,.035),
 'thoro':profile('refined',.038,.08,.035,.020,.010,.006,.024,.030),
 'akhal':profile('refined',.040,.08,.040,.020,.010,.006,.026,.030),
 'marwari':profile('refined',.046,.10,.045,.025,.012,.007,.028,.035),
}

def c2(a,b,x):
    t=np.clip((x-a)/(b-a),0.,1.)
    return t*t*t*(10.+t*(-15.+6.*t))

def _regional_sculpt(points,key,frame):
    p=np.asarray(points,dtype=float)
    if key not in PROFILES:return p.copy()
    art=PROFILES[key];origin,side,axis,face=frame
    u,t,d=((p-origin)@np.stack([side,axis,face]).T).T
    mask=c2(-.21,-.10,t)*(1-c2(.72,.90,t))
    mask*=1-c2(.20,.32,abs(u));mask*=1-c2(.23,.35,abs(d+.025))
    # The eye/forehead area stays broad while the distal face is genuinely
    # shorter; this is a compact profile sculpt, not a uniform head scale.
    axial=-art['faceShortenM']*c2(.12,.58,t)*mask
    width=art['foreheadGain']*(1-c2(.20,.46,t))+art['cheekGain']*np.exp(-((t-.25)/.17)**2)-.065*c2(.38,.62,t)
    lateral=u*width*mask
    dorsal=(.016*np.exp(-((t-.045)/.16)**2)-.010*np.exp(-((t-.32)/.18)**2))*mask
    out=p+axial[:,None]*axis+lateral[:,None]*side+dorsal[:,None]*face
    x,y,z=p.T
    # A broad crest sweep follows the upper neck and poll. Its lower support is
    # above the corrected elbow/forearm; a compact falloff retains the muzzle.
    neck=c2(1.38,1.82,y)*c2(.44,.68,z)*(1-c2(1.06,1.28,z))
    neck*=1-c2(.20,.38,abs(x))
    out[:,1]+=art['neckArchM']*neck
    out[:,2]-=art['neckSweepM']*neck
    out[:,0]-=.055*x*neck
    # Round the connected barrel/quarter at its upper mass, rather than adding
    # swelling to articulated thigh/gaskin surfaces. Hoof/shaft support is zero.
    mass=c2(1.22,1.53,y)*(1-c2(1.72,1.86,y))*c2(-1.10,-.78,z)*(1-c2(.18,.49,z))
    rear=c2(-.30,-.82,z)
    out[:,0]+=x*(art['bodyRoundGain']+art['quarterExtraGain']*rear)*mass
    out[:,1]+=art['quarterLiftM']*rear*mass
    return out

def sculpt(points,key,frame):
    p=np.asarray(points,dtype=float)
    out=_regional_sculpt(p,key,frame)
    if key not in PROFILES:return out
    origin,side,axis,face=frame
    u,t,d=((p-origin)@np.stack([side,axis,face]).T).T
    # Both ears and the poll travel together. Their pointed source surfaces
    # must not bend where forehead width and neck-lift fields meet.
    poll=c2(-.40,-.20,t)*(1-c2(.005,.18,t))
    poll*=1-c2(.20,.32,abs(u))
    poll*=c2(-.30,-.15,d)*(1-c2(.20,.35,d))
    bases=np.array([origin-.085*side,origin+.085*side])
    shifts=_regional_sculpt(bases,key,frame)-bases
    between=c2(-.025,.025,u)
    shift=shifts[0]+between[:,None]*(shifts[1]-shifts[0])
    return out+poll[:,None]*(shift-(out-p))


def deform(points,normals,key,frame):
    p=np.asarray(points,dtype=float);q=sculpt(p,key,frame);eps=1e-5
    jac=np.stack([(sculpt(p+np.eye(3)[a]*eps,key,frame)-sculpt(p-np.eye(3)[a]*eps,key,frame))/(2*eps) for a in range(3)],axis=2)
    determinant=np.linalg.det(jac)
    assert np.isfinite(q).all() and np.isfinite(jac).all() and determinant.min()>.3,(key,'equestrian field inversion',float(determinant.min()))
    n=np.asarray(normals,dtype=float).copy();changed=np.linalg.norm(q-p,axis=1)>1e-12
    if changed.any():n[changed]=np.linalg.solve(jac[changed].transpose(0,2,1),n[changed,...,None])[...,0]
    return q,n,{'version':VERSION,'parameters':dict(PROFILES[key]),'minJacobianDeterminant':float(determinant.min()),
                'affectedVertices':int(changed.sum()),'maxAdditionalDeltaM':float(np.linalg.norm(q-p,axis=1).max()),
                'lowerSurfaceUnchangedBelowM':1.22,'sharedBodyEyesTackHairField':True, 'ears':'Rigid shared poll translation above longitudinal .005m; smooth transition to forehead by .18m',
                'method':'Shared compact head-space face shortening/forehead sculpt, high-neck arch and connected upper-quarter surface mass. Original skeleton, weights and clips unchanged.'}
