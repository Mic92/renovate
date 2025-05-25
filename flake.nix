{
  description = "Development environment for this project";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs, ... }:
    let
      # define the systems we want to support
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      # helper function to generate attributes for each system
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      nixosModules = {
        renovate = ({ pkgs, ... }: {
          services.renovate.package = self.packages.${pkgs.hostPlatform.system}.renovate;
        });
        default = self.nixosModules.renovate;
      };
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          renovate = pkgs.renovate.overrideAttrs (
            final: prev: {
              version = "unstable";
              src = ./.;
              pnpmDeps = prev.pnpmDeps.override {
                inherit (final) pname version src;
                hash = "sha256-unj6CbzV+K1cRVneChQDwaekpKpjKLU8fH+c4Y2KzrU=";
              };
            }
          );

          default = self.packages.${system}.renovate;

          # $ nix run .#nix-update-fod-hash
          nix-update-fod-hash = pkgs.writeShellApplication {
            name = "nix-update-fod-hash";
            runtimeInputs = [ pkgs.nix-update ];
            text = ''
              nix-update --version skip --flake renovate "$@"
            '';
          };
        }
      );
    };
}
