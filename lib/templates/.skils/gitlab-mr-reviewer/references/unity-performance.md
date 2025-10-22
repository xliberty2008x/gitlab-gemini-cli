# Unity Performance Best Practices

## Per-Frame Performance Rules

### ❌ Never in Update/FixedUpdate

**Component Lookups:**
```csharp
// ❌ BAD: O(n) component search every frame
void Update() {
    var renderer = GetComponent<Renderer>();
    renderer.material.color = Color.red;
}

// ✅ GOOD: Cache in Awake
private Renderer _renderer;

void Awake() {
    _renderer = GetComponent<Renderer>();
}

void Update() {
    _renderer.material.color = Color.red;
}
```

**GameObject Searches:**
```csharp
// ❌ BAD: Searches entire scene every frame
void Update() {
    var player = FindObjectOfType<Player>();
    if (Vector3.Distance(transform.position, player.transform.position) < 5f) {
        // ...
    }
}

// ✅ GOOD: Cache reference or use events
private Player _player;

void Start() {
    _player = FindObjectOfType<Player>(); // Once at start
}

void Update() {
    if (Vector3.Distance(transform.position, _player.transform.position) < 5f) {
        // ...
    }
}
```

**Camera.main:**
```csharp
// ❌ BAD: Calls FindGameObjectWithTag internally
void Update() {
    var direction = Camera.main.transform.forward;
}

// ✅ GOOD: Cache the camera
private Camera _mainCamera;

void Awake() {
    _mainCamera = Camera.main;
}

void Update() {
    var direction = _mainCamera.transform.forward;
}
```

### ❌ LINQ in Hot Paths

```csharp
// ❌ BAD: Allocations every frame
void Update() {
    var activeEnemies = _enemies.Where(e => e.IsActive).ToList(); // GC pressure!
    var nearbyEnemies = activeEnemies.Where(e => Vector3.Distance(e.position, transform.position) < 10f);
}

// ✅ GOOD: Use for loops with early exit
void Update() {
    _nearbyEnemies.Clear();
    for (int i = 0; i < _enemies.Count; i++) {
        if (!_enemies[i].IsActive) continue;
        if (Vector3.Distance(_enemies[i].position, transform.position) < 10f) {
            _nearbyEnemies.Add(_enemies[i]);
        }
    }
}
```

### ❌ String Operations

```csharp
// ❌ BAD: String concat allocates
void Update() {
    var debugText = "Position: " + transform.position + " Health: " + health;
    _debugLabel.text = debugText;
}

// ✅ GOOD: Use StringBuilder or string.Format (cached)
private StringBuilder _sb = new StringBuilder(100);

void Update() {
    _sb.Clear();
    _sb.Append("Position: ");
    _sb.Append(transform.position);
    _sb.Append(" Health: ");
    _sb.Append(health);
    _debugLabel.text = _sb.ToString();
}

// ✅ ALSO GOOD: TextMeshPro with formatted strings (less GC than UI.Text)
void Update() {
    _debugLabel.SetText("Position: {0} Health: {1}", transform.position, health);
}
```

### ❌ Boxing in Hot Paths

```csharp
// ❌ BAD: Boxing value types
void Update() {
    var position = transform.position;
    Debug.Log("Position: " + position); // Boxes Vector3 to object
}

// ✅ GOOD: Use formatted string or interpolation
void Update() {
    Debug.LogFormat("Position: {0}", transform.position); // No boxing
}

// ❌ BAD: Dictionary with value type keys/values boxes on lookup
Dictionary<int, Vector3> _positions = new Dictionary<int, Vector3>();

void Update() {
    if (_positions.ContainsKey(entityId)) { // Boxing!
        var pos = _positions[entityId];
    }
}

// ✅ GOOD: Check reference types or use specific collections
Dictionary<int, Transform> _transforms = new Dictionary<int, Transform>();
```

## Object Pooling

**When to Pool:**
- Objects spawned/destroyed >5 times per frame
- Frequent particle effects, projectiles, damage numbers
- Any gameplay object in tight loops

```csharp
// ❌ BAD: Instantiate/Destroy churn
void FireBullet() {
    var bullet = Instantiate(_bulletPrefab, _muzzle.position, _muzzle.rotation);
    Destroy(bullet, 5f);
}

// ✅ GOOD: Object pool
public class BulletPool {
    private Queue<Bullet> _pool = new Queue<Bullet>();
    private GameObject _prefab;
    private Transform _parent;

    public Bullet Get() {
        if (_pool.Count > 0) {
            var bullet = _pool.Dequeue();
            bullet.gameObject.SetActive(true);
            return bullet;
        }
        return Object.Instantiate(_prefab, _parent).GetComponent<Bullet>();
    }

    public void Return(Bullet bullet) {
        bullet.gameObject.SetActive(false);
        _pool.Enqueue(bullet);
    }
}
```

## Coroutines vs async/await

**Prefer async/await for:**
- Network calls
- Asset loading
- Any I/O operations
- Long-running operations that can truly be async

**Use Coroutines for:**
- Frame-based timing (WaitForEndOfFrame, WaitForFixedUpdate)
- Animation sequences
- Simple delays tied to game time

```csharp
// ✅ GOOD: async/await for async operations
public async UniTask LoadSceneDataAsync() {
    var handle = Addressables.LoadAssetAsync<SceneData>("SceneData");
    var data = await handle.Task;
    // Process data
    Addressables.Release(handle);
}

// ✅ GOOD: Coroutine for frame timing
IEnumerator FlashDamage() {
    _renderer.material.color = Color.red;
    yield return new WaitForSeconds(0.1f);
    _renderer.material.color = Color.white;
}
```

## Async Best Practices

### ❌ Never Block on Async

```csharp
// 🔴 CRITICAL: Deadlock risk!
void Start() {
    var data = LoadDataAsync().Result; // NEVER!
    var data2 = LoadDataAsync().Wait(); // NEVER!
}

// ✅ CORRECT: Use async all the way
async void Start() {
    var data = await LoadDataAsync();
}

// OR use UniTask if you need more control
async UniTaskVoid StartAsync() {
    var data = await LoadDataAsync();
}
```

### ❌ async void (except Unity event handlers)

```csharp
// ❌ BAD: Swallows exceptions, can't await
async void LoadDataAsync() {
    var data = await FetchData();
    ProcessData(data);
}

// ✅ GOOD: Return Task or UniTask
async UniTask LoadDataAsync() {
    var data = await FetchData();
    ProcessData(data);
}

// ✅ EXCEPTION: Unity event handlers can be async void
async void Start() {
    await InitializeAsync();
}
```

## Profiler-Driven Optimization

**Always profile before optimizing:**

1. **Deep Profile Mode** - Shows exact method costs
2. **Memory Profiler** - Find leaks and allocations
3. **Frame Debugger** - GPU performance issues

**Key Metrics:**
- `GC.Alloc` - Should be 0 in Update loops
- `GetComponent` calls - Should not be in hot paths
- `Instantiate` calls - Should use pooling if frequent

## Unity-Specific Performance Tips

**Transform Operations:**
```csharp
// ❌ SLOWER: Multiple transform accesses
void Update() {
    var pos = transform.position;
    pos.x += speed * Time.deltaTime;
    transform.position = pos;
    var rot = transform.rotation;
    // ...
}

// ✅ FASTER: Cache transform reference
private Transform _transform;

void Awake() {
    _transform = transform;
}

void Update() {
    var pos = _transform.position;
    pos.x += speed * Time.deltaTime;
    _transform.position = pos;
}
```

**Material Property Blocks (avoid material instancing):**
```csharp
// ❌ BAD: Creates material instance
void ChangeColor() {
    GetComponent<Renderer>().material.color = Color.red; // Instantiates!
}

// ✅ GOOD: Use MaterialPropertyBlock
private MaterialPropertyBlock _propBlock;
private Renderer _renderer;
private static readonly int ColorProperty = Shader.PropertyToID("_Color");

void Awake() {
    _renderer = GetComponent<Renderer>();
    _propBlock = new MaterialPropertyBlock();
}

void ChangeColor() {
    _propBlock.SetColor(ColorProperty, Color.red);
    _renderer.SetPropertyBlock(_propBlock);
}
```

**Use Shader.PropertyToID:**
```csharp
// ❌ BAD: String lookup every time
material.SetFloat("_Transparency", 0.5f);

// ✅ GOOD: Cache property ID
private static readonly int TransparencyID = Shader.PropertyToID("_Transparency");

material.SetFloat(TransparencyID, 0.5f);
```

## GC Allocation Hotspots

**Watch out for:**
- String operations (concat, format, interpolation)
- LINQ queries
- Boxing value types
- `foreach` on non-collections (use `for` on arrays/lists)
- Lambda allocations in hot paths
- Coroutine WaitForSeconds (cache instances)

```csharp
// ❌ Allocates new WaitForSeconds every call
IEnumerator Wait() {
    yield return new WaitForSeconds(1f); // Allocation!
}

// ✅ Cache WaitForSeconds
private WaitForSeconds _waitOneSecond = new WaitForSeconds(1f);

IEnumerator Wait() {
    yield return _waitOneSecond; // No allocation
}
```
