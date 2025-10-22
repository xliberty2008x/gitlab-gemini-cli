# Unity Anti-Patterns and Common Mistakes

## Update Loop Anti-Patterns

### 1. ❌ GetComponent in Update

**Why it's bad:** `GetComponent` uses internal lookups. Doing this every frame kills performance.

```csharp
// ❌ ANTI-PATTERN
void Update() {
    GetComponent<Rigidbody>().velocity = Vector3.forward * speed;
}

// ✅ CORRECT
private Rigidbody _rb;

void Awake() {
    _rb = GetComponent<Rigidbody>();
}

void Update() {
    _rb.velocity = Vector3.forward * speed;
}
```

### 2. ❌ GameObject.Find / FindObjectOfType in Update

**Why it's bad:** These search the ENTIRE scene hierarchy every call. O(n) performance.

```csharp
// ❌ ANTI-PATTERN
void Update() {
    var player = GameObject.Find("Player");
    var distance = Vector3.Distance(transform.position, player.transform.position);
}

// ✅ CORRECT: Cache reference
private GameObject _player;

void Start() {
    _player = GameObject.Find("Player"); // Once at start
}

void Update() {
    var distance = Vector3.Distance(transform.position, _player.transform.position);
}

// ✅ EVEN BETTER: Use events/signals instead of constant distance checks
```

### 3. ❌ Camera.main Every Frame

**Why it's bad:** `Camera.main` internally calls `FindGameObjectWithTag`, which is slow.

```csharp
// ❌ ANTI-PATTERN
void Update() {
    transform.LookAt(Camera.main.transform);
}

// ✅ CORRECT
private Camera _mainCamera;

void Awake() {
    _mainCamera = Camera.main;
}

void Update() {
    transform.LookAt(_mainCamera.transform);
}
```

## Initialization Anti-Patterns

### 4. ❌ Doing Work in Awake/Start That Could Fail

**Why it's bad:** Awake/Start can't be async, can't handle errors well, blocks scene loading.

```csharp
// ❌ ANTI-PATTERN
void Start() {
    var data = Resources.Load<GameData>("GameData");
    if (data == null) {
        Debug.LogError("Failed to load!");
        // But script continues anyway...
    }
    InitializeGame(data);
}

// ✅ CORRECT: Use async initialization
async void Start() {
    try {
        var data = await LoadGameDataAsync();
        InitializeGame(data);
    } catch (Exception ex) {
        Debug.LogError($"Failed to initialize: {ex.Message}");
        ShowErrorScreen();
    }
}
```

### 5. ❌ Resources.Load in Production Code

**Why it's bad:** Synchronous, blocks main thread, can't be unloaded individually, no versioning.

```csharp
// ❌ ANTI-PATTERN
void Start() {
    var prefab = Resources.Load<GameObject>("Prefabs/Enemy");
    Instantiate(prefab);
}

// ✅ CORRECT: Use Addressables
async void Start() {
    var handle = Addressables.LoadAssetAsync<GameObject>("Enemy");
    var prefab = await handle.Task;
    Instantiate(prefab);
    Addressables.Release(handle);
}
```

## Memory Anti-Patterns

### 6. ❌ String Concatenation in Loops

**Why it's bad:** Each concatenation creates a new string object (strings are immutable).

```csharp
// ❌ ANTI-PATTERN
string result = "";
for (int i = 0; i < 1000; i++) {
    result += i.ToString() + ","; // 1000 string allocations!
}

// ✅ CORRECT
var sb = new StringBuilder(10000);
for (int i = 0; i < 1000; i++) {
    sb.Append(i);
    sb.Append(',');
}
string result = sb.ToString();
```

### 7. ❌ LINQ in Update

**Why it's bad:** LINQ methods often allocate enumerators and intermediate collections.

```csharp
// ❌ ANTI-PATTERN
void Update() {
    var activeEnemies = _enemies.Where(e => e.IsActive).ToList(); // GC every frame!
    var count = activeEnemies.Count;
}

// ✅ CORRECT
void Update() {
    int count = 0;
    for (int i = 0; i < _enemies.Count; i++) {
        if (_enemies[i].IsActive) {
            count++;
        }
    }
}
```

### 8. ❌ Not Pooling Frequently Instantiated Objects

**Why it's bad:** `Instantiate` and `Destroy` are expensive. GC pressure from constant allocation/deallocation.

```csharp
// ❌ ANTI-PATTERN
void Fire() {
    var bullet = Instantiate(_bulletPrefab);
    Destroy(bullet, 3f);
}

// ✅ CORRECT: Use object pool
public class BulletPool {
    private Queue<Bullet> _pool = new Queue<Bullet>();
    
    public Bullet Get() {
        if (_pool.Count > 0) {
            var bullet = _pool.Dequeue();
            bullet.gameObject.SetActive(true);
            return bullet;
        }
        return Object.Instantiate(_bulletPrefab).GetComponent<Bullet>();
    }
    
    public void Return(Bullet bullet) {
        bullet.gameObject.SetActive(false);
        _pool.Enqueue(bullet);
    }
}
```

## Architecture Anti-Patterns

### 9. ❌ God Objects / Singletons Everywhere

**Why it's bad:** Hard to test, creates hidden dependencies, leads to spaghetti code.

```csharp
// ❌ ANTI-PATTERN
public class GameManager : MonoBehaviour {
    public static GameManager Instance;
    
    public PlayerData playerData;
    public InventorySystem inventory;
    public QuestSystem quests;
    public AudioSystem audio;
    public SaveSystem saves;
    // ... 20 more systems
    
    void Awake() {
        Instance = this;
    }
}

// Used everywhere:
GameManager.Instance.playerData.AddExperience(10);
GameManager.Instance.audio.PlaySound("Ding");

// ✅ CORRECT: Use dependency injection
public class Player {
    private readonly IPlayerService _playerService;
    private readonly IAudioService _audioService;
    
    public Player(IPlayerService playerService, IAudioService audioService) {
        _playerService = playerService;
        _audioService = audioService;
    }
    
    public void GainExperience(int amount) {
        _playerService.AddExperience(amount);
        _audioService.PlaySound("LevelUp");
    }
}
```

### 10. ❌ Business Logic in MonoBehaviours

**Why it's bad:** Can't unit test, tied to Unity lifecycle, mixed responsibilities.

```csharp
// ❌ ANTI-PATTERN
public class Player : MonoBehaviour {
    private float _health = 100f;
    private int _level = 1;
    private int _experience = 0;
    
    void Update() {
        if (_experience >= _level * 100) {
            LevelUp();
        }
    }
    
    void LevelUp() {
        _level++;
        _health = _level * 100;
        // More business logic...
    }
}

// ✅ CORRECT: Separate view and logic
public class PlayerView : MonoBehaviour {
    private PlayerMediator _mediator;
    
    [Inject]
    public void Construct(PlayerMediator mediator) {
        _mediator = mediator;
        _mediator.OnLevelUp += ShowLevelUpEffect;
    }
}

public class PlayerMediator {
    private readonly PlayerData _data;
    
    public event Action OnLevelUp;
    
    public void Update() {
        if (_data.Experience >= _data.Level * 100) {
            LevelUp();
        }
    }
    
    private void LevelUp() {
        _data.Level++;
        _data.Health = _data.Level * 100;
        OnLevelUp?.Invoke();
    }
}
```

### 11. ❌ Using SendMessage / BroadcastMessage

**Why it's bad:** Reflection-based, slow, error-prone (no compile-time checks), breaks refactoring.

```csharp
// ❌ ANTI-PATTERN
gameObject.SendMessage("TakeDamage", 10);

// ✅ CORRECT: Direct reference or events
// Option 1: Direct call
var damageable = GetComponent<IDamageable>();
damageable?.TakeDamage(10);

// Option 2: Event system
_damageEvent.Invoke(10);
```

## Async Anti-Patterns

### 12. ❌ async void (Except Unity Callbacks)

**Why it's bad:** Exceptions are swallowed, can't be awaited, fire-and-forget behavior.

```csharp
// ❌ ANTI-PATTERN
async void LoadDataAsync() {
    var data = await FetchData();
    ProcessData(data); // If this throws, exception is lost!
}

// ✅ CORRECT
async UniTask LoadDataAsync() {
    var data = await FetchData();
    ProcessData(data);
}

// Can await:
await LoadDataAsync();

// ✅ EXCEPTION: Unity event handlers can be async void
async void Start() {
    await InitializeAsync();
}
```

### 13. ❌ Blocking on Async with .Result / .Wait()

**Why it's bad:** Deadlocks on Unity main thread, defeats purpose of async.

```csharp
// 🔴 CRITICAL ANTI-PATTERN - Can deadlock!
void Start() {
    var data = LoadDataAsync().Result; // NEVER!
}

// ✅ CORRECT
async void Start() {
    var data = await LoadDataAsync();
}
```

### 14. ❌ Not Handling Async Exceptions

**Why it's bad:** Silent failures, undefined state.

```csharp
// ❌ ANTI-PATTERN
async UniTask LoadLevel() {
    var level = await Addressables.LoadSceneAsync("Level1").Task;
    // What if this fails?
}

// ✅ CORRECT
async UniTask LoadLevel() {
    try {
        var level = await Addressables.LoadSceneAsync("Level1").Task;
    } catch (Exception ex) {
        Debug.LogError($"Failed to load level: {ex.Message}");
        ShowErrorScreen();
    }
}
```

## Input Anti-Patterns

### 15. ❌ Mixing Input Systems

**Why it's bad:** Conflicts, confusion, double-input processing.

```csharp
// ❌ ANTI-PATTERN: Mixing old and new
void Update() {
    // Old Input Manager
    if (Input.GetKeyDown(KeyCode.Space)) {
        Jump();
    }
    
    // New Input System
    if (_jumpAction.triggered) {
        Jump();
    }
}

// ✅ CORRECT: Pick one system
// If using New Input System:
void OnEnable() {
    _jumpAction.performed += OnJump;
}

void OnDisable() {
    _jumpAction.performed -= OnJump;
}

void OnJump(InputAction.CallbackContext context) {
    Jump();
}
```

## Prefab Anti-Patterns

### 16. ❌ Modifying Prefab Assets at Runtime

**Why it's bad:** Changes affect ALL instances, persists between play sessions (in Editor).

```csharp
// ❌ ANTI-PATTERN
[SerializeField] private GameObject _enemyPrefab;

void SpawnEnemy() {
    _enemyPrefab.GetComponent<Enemy>().health = 50; // ❌ Modifies the prefab!
    Instantiate(_enemyPrefab);
}

// ✅ CORRECT: Modify instance, not prefab
void SpawnEnemy() {
    var instance = Instantiate(_enemyPrefab);
    instance.GetComponent<Enemy>().health = 50; // ✅ Modifies only this instance
}
```

## Coroutine Anti-Patterns

### 17. ❌ Using Coroutines for Async I/O

**Why it's bad:** Coroutines block on main thread, async/await is better for I/O.

```csharp
// ❌ ANTI-PATTERN
IEnumerator LoadData() {
    var www = UnityWebRequest.Get(url);
    yield return www.SendWebRequest(); // Blocks main thread polling
}

// ✅ CORRECT: Use async/await
async UniTask LoadData() {
    var www = UnityWebRequest.Get(url);
    await www.SendWebRequest(); // True async, doesn't block
}
```

### 18. ❌ Not Stopping Coroutines on Destroy

**Why it's bad:** Coroutines continue after object destroyed, causing null references.

```csharp
// ❌ ANTI-PATTERN
void Start() {
    StartCoroutine(UpdateHealthBar());
}

IEnumerator UpdateHealthBar() {
    while (true) {
        _healthBar.value = _health; // ❌ Runs after GameObject destroyed!
        yield return new WaitForSeconds(0.1f);
    }
}

// ✅ CORRECT: Stop on destroy
private Coroutine _healthBarCoroutine;

void Start() {
    _healthBarCoroutine = StartCoroutine(UpdateHealthBar());
}

void OnDestroy() {
    if (_healthBarCoroutine != null) {
        StopCoroutine(_healthBarCoroutine);
    }
}
```

## Editor Anti-Patterns

### 19. ❌ Using [ExecuteInEditMode] Carelessly

**Why it's bad:** Runs in edit mode, can corrupt data, confuses developers.

```csharp
// ❌ ANTI-PATTERN
[ExecuteInEditMode]
public class AutoSave : MonoBehaviour {
    void Update() {
        SaveGame(); // ❌ Runs in editor, saves constantly!
    }
}

// ✅ CORRECT: Use Application.isPlaying check
[ExecuteInEditMode]
public class EditorHelper : MonoBehaviour {
    void Update() {
        if (Application.isPlaying) {
            return; // Don't run in edit mode
        }
        
        // Editor-only logic
    }
}
```

## Shader Anti-Patterns

### 20. ❌ Shader.Find at Runtime

**Why it's bad:** Slow, can fail if shader not included in build.

```csharp
// ❌ ANTI-PATTERN
void ApplyEffect() {
    var material = new Material(Shader.Find("Custom/GlowShader"));
    _renderer.material = material;
}

// ✅ CORRECT: Assign in Inspector or cache
[SerializeField] private Shader _glowShader;

void ApplyEffect() {
    var material = new Material(_glowShader);
    _renderer.material = material;
}
```

## Review Checklist

When reviewing code, flag these anti-patterns:

- [ ] GetComponent/Find/Camera.main in Update loops
- [ ] Resources.Load instead of Addressables
- [ ] String concatenation in loops
- [ ] LINQ in Update
- [ ] No object pooling for frequent Instantiate
- [ ] Singleton abuse / God objects
- [ ] Business logic in MonoBehaviours
- [ ] SendMessage instead of direct calls
- [ ] async void (except Unity callbacks)
- [ ] .Result/.Wait() on async operations
- [ ] Mixed Input System usage
- [ ] Modifying prefab assets directly
- [ ] Coroutines for I/O operations
- [ ] Shader.Find at runtime
