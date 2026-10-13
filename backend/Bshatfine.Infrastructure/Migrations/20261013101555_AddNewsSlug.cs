using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bshatfine.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsSlug : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "News",
                type: "character varying(70)",
                maxLength: 70,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql(
    "UPDATE \"News\" SET \"Slug\" = 'news-' || right(replace(\"Id\"::text, '-', ''), 4);");

            migrationBuilder.CreateIndex(
                name: "IX_News_Slug",
                table: "News",
                column: "Slug",
                unique: true);

            
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_News_Slug",
                table: "News");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "News");
        }
    }
}
