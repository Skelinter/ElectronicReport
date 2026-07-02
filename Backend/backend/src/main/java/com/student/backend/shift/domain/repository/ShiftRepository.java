package com.student.backend.shift.domain.repository;

import com.student.backend.shift.domain.enums.ShiftStatus;
import com.student.backend.shift.domain.model.Shift;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShiftRepository extends JpaRepository<Shift, UUID> {

    Page<Shift> findByDepartment_DepartmentIdAndStartedAtBetween(
            UUID departmentId,
            OffsetDateTime from,
            OffsetDateTime to,
            Pageable pageable
    );

    Page<Shift> findByStartedAtBetween(
            OffsetDateTime from,
            OffsetDateTime to,
            Pageable pageable
    );

    Optional<Shift> findFirstByEngineer_UserIdAndStatusOrderByStartedAtDesc(
            UUID userId,
            ShiftStatus status
    );

    Optional<Shift> findFirstByDepartment_DepartmentIdAndStartedAtBeforeOrderByStartedAtDesc(
            UUID departmentId,
            OffsetDateTime startedAt
    );

    List<Shift> findAllByDepartment_DepartmentIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtAsc(
            UUID departmentId,
            OffsetDateTime fromInclusive,
            OffsetDateTime toExclusive
    );

    @Query("""
            SELECT s
            FROM Shift s
            JOIN s.department d
            WHERE (:departmentId IS NULL OR d.departmentId = :departmentId)
              AND s.startedAt >= :fromInclusive
              AND s.startedAt < :toExclusive
              AND (
                  LOWER(d.name) LIKE LOWER(CONCAT('%', :search, '%'))
                  OR LOWER(d.shortName) LIKE LOWER(CONCAT('%', :search, '%'))
              )
            """)
    Page<Shift> findByDepartmentAndDateRangeWithSearch(
            @Param("departmentId") UUID departmentId,
            @Param("fromInclusive") OffsetDateTime fromInclusive,
            @Param("toExclusive") OffsetDateTime toExclusive,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            SELECT s
            FROM Shift s
            JOIN s.department d
            WHERE s.startedAt >= :fromInclusive
              AND s.startedAt < :toExclusive
              AND (
                  LOWER(d.name) LIKE LOWER(CONCAT('%', :search, '%'))
                  OR LOWER(d.shortName) LIKE LOWER(CONCAT('%', :search, '%'))
              )
            """)
    Page<Shift> findByDateRangeWithSearchAllDepartments(
            @Param("fromInclusive") OffsetDateTime fromInclusive,
            @Param("toExclusive") OffsetDateTime toExclusive,
            @Param("search") String search,
            Pageable pageable
    );
}