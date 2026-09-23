#pragma once
#include "core/ProductCatalog.h"
#include "services/IApiClient.h"
#include "update/ProductUpdater.h"
#include <d3d11.h>
#include <windows.h>
#include <memory>
#include <thread>
#include <unordered_map>
#include <string>

namespace crazzy {
class MainWindow {
public:
    explicit MainWindow(HINSTANCE instance, std::unique_ptr<IApiClient> api);
    ~MainWindow();
    int Run(int showCommand);

private:
    struct RuntimeTask {
        update::TaskStatus status;
        std::jthread worker;
        bool autoLaunch{false};
        bool launchIssued{false};
        std::wstring targetVersion;
    };
    struct InfoModal {
        bool open{false};
        std::string popupId{"##info_modal"};
        std::wstring title;
        std::wstring message;
        std::wstring primaryLabel{L"OK"};
    };

    static LRESULT CALLBACK StaticWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp);
    LRESULT WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp);
    bool CreateDeviceD3D(HWND hwnd);
    void CleanupDeviceD3D();
    void CreateRenderTarget();
    void CleanupRenderTarget();
    void ApplyStyle();
    void DrawUi();
    void DrawBackgroundDecor();
    void DrawTitleBar();
    void DrawLogin();
    void DrawLibrary();
    void DrawSidebar();
    void DrawProductCard(Product& product);
    void DrawModals();
    void RefreshProducts();
    void BeginUpdate(Product product, bool autoLaunch);
    void LaunchProduct(const Product& product);
    void ShowInfoModal(const std::wstring& title, const std::wstring& message, const std::wstring& buttonLabel = L"OK");
    void RequestWindowMove();
    void ToggleMaximize();
    RuntimeTask* TaskFor(const std::wstring& productId);

    HINSTANCE instance_{};
    HWND hwnd_{};
    std::unique_ptr<IApiClient> api_;
    ProductCatalog catalog_;
    std::unordered_map<std::wstring, bool> revealKeys_;
    std::unordered_map<std::wstring, std::unique_ptr<RuntimeTask>> tasks_;
    Product* pendingUpdateProduct_{nullptr};
    bool loggedIn_{false};
    bool maximized_{false};
    InfoModal infoModal_{};

    ID3D11Device* device_{};
    ID3D11DeviceContext* context_{};
    IDXGISwapChain* swapChain_{};
    ID3D11RenderTargetView* renderTarget_{};
};
}
